"""Tiny public HTTP service for double-opt-in update-email signups.

Stdlib only (http.server) -- no new deps -- listening on localhost; the box's
Caddy reverse-proxies /api/* to it over HTTPS. The request logic lives in the
pure `route()` function (testable with fakes, no socket); `SubscribeHandler` is a
thin shell that parses the request and writes the Response.

Endpoints:
  POST /api/subscribe          JSON {email, website?} -> {"status": "..."}; verify email
  GET  /api/verify?token=...   confirmation PAGE (a form); POST performs the verify
  POST /api/verify             confirm -> welcome email -> "you're in" page
  GET  /api/unsubscribe?token= confirmation PAGE (a form); POST performs the removal
  POST /api/unsubscribe?token= remove from the list (also RFC 8058 one-click target)

State changes happen on POST only: a bare GET to verify/unsubscribe just renders a
confirmation form, so mail-security scanners and link prefetchers that follow GET
links cannot confirm or unsubscribe a human without an actual click/submit.

`/api/subscribe` speaks JSON to match the site's inline fetch (src/scripts/
subscribe.ts posts {email} and reads {status}). It is enumeration-safe: a valid
email -- new OR already on the list -- always returns {"status": "subscribed"};
only a malformed address returns {"status": "invalid"}; a filled honeypot returns
{"status": "subscribed"} and sends nothing.

Hardening: per-IP rate limit (locked), bot honeypot, capped/validated body size,
email validation, enumeration-safe subscribe response, no reflected user input,
no open redirects (pages rendered inline).

Ported (trimmed) from dc-frontier-events: dropped calendar.ics / analytics /
preferences / profile / sources; subscribe now speaks JSON instead of rendering
an inbox page (the site renders inline status from the JSON).
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass, field
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlsplit

from subscribers import SubscriberStore

MAX_BODY = 8192            # bytes; signup posts are tiny
RATE_MAX = 10             # max signup POSTs per window, per IP
# Generous limiter for the read/token endpoints (verify, unsubscribe): high enough
# to never throttle a human clicking a link, but enough to stop a single IP from
# flooding the token endpoints.
RATE_MAX_READ = 120       # per window, per IP
RATE_WINDOW_S = 3600      # per hour, per IP
HONEYPOT_FIELD = "website"  # hidden in the form; humans leave it empty
# Endpoints sharing the generous read limiter (subscribe keeps its own strict one).
READ_PATHS = frozenset({"/api/verify", "/api/unsubscribe"})


@dataclass
class Response:
    status: int
    body: str | bytes
    content_type: str = "text/html; charset=utf-8"
    location: str | None = None
    headers: dict | None = None


class RateLimiter:
    """In-memory sliding-window limiter keyed by client IP. Process-local, which
    is fine for a single-instance signup endpoint (abuse protection, not auth)."""

    def __init__(self, max_hits: int = RATE_MAX, window_s: int = RATE_WINDOW_S):
        self.max_hits = max_hits
        self.window_s = window_s
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()   # ThreadingHTTPServer calls this concurrently
        self._calls = 0

    def allow(self, key: str, now: float) -> bool:
        with self._lock:
            hits = [t for t in self._hits.get(key, []) if now - t < self.window_s]
            if len(hits) >= self.max_hits:
                self._hits[key] = hits
                return False
            hits.append(now)
            self._hits[key] = hits
            self._calls += 1
            if self._calls % 256 == 0:
                # Sweep inline while the lock is held to avoid re-entrant deadlock.
                self._hits = {k: kept for k, v in self._hits.items()
                              if (kept := [t for t in v if now - t < self.window_s])}
            return True

    def sweep(self, now: float) -> None:
        """Drop keys whose timestamps have all aged out of the window, so the dict
        doesn't grow unbounded with one entry per IP ever seen."""
        with self._lock:
            self._hits = {k: kept for k, v in self._hits.items()
                          if (kept := [t for t in v if now - t < self.window_s])}

    def key_count(self) -> int:
        return len(self._hits)


@dataclass
class Deps:
    store: SubscriberStore
    send_verify: callable      # (email, token) -> None
    send_welcome: callable     # (email, unsub_token) -> None
    rate: RateLimiter          # strict, signup-only
    # Generous limiter for the read/token endpoints (see READ_PATHS / RATE_MAX_READ).
    rate_read: RateLimiter = field(
        default_factory=lambda: RateLimiter(RATE_MAX_READ, RATE_WINDOW_S))


_PAGE_CSS = (
    "body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#000;"
    "color:#f5f5f7;margin:0;padding:0}.card{max-width:460px;margin:8vh auto;background:#1d1d1f;"
    "border:1px solid #424245;border-radius:16px;padding:32px 30px}"
    "h1{font-size:20px;margin:0 0 8px;letter-spacing:-.02em}"
    "p{font-size:15px;line-height:1.55;color:#a1a1a6}"
    "a{color:#2997ff}.muted{color:#86868b;font-size:13px}"
)


def _page(title: str, heading: str, message_html: str, status: int = 200) -> Response:
    body = (
        f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{title}</title><style>{_PAGE_CSS}</style></head><body>'
        f'<div class="card"><h1>{heading}</h1>{message_html}</div></body></html>'
    )
    return Response(status, body)


def _json_response(status_word: str, http_status: int = 200) -> Response:
    return Response(http_status, json.dumps({"status": status_word}),
                    content_type="application/json; charset=utf-8")


def route(method: str, path: str, query: dict, form: dict, client_ip: str,
          deps: Deps, now: float) -> Response:
    """Pure request handler: inputs in, Response out, side effects only via deps."""
    if path in READ_PATHS and not deps.rate_read.allow(client_ip, now):
        return _page("Slow down", "Too many requests",
                     '<p>Please try again in a little while.</p>', status=429)

    if path == "/api/subscribe" and method == "POST":
        if not deps.rate.allow(client_ip, now):
            return _json_response("error", 429)
        # Honeypot: a bot fills the hidden field -> pretend success, do nothing
        # (enumeration-safe & indistinguishable from a real signup).
        if _field(form, HONEYPOT_FIELD).strip():
            return _json_response("subscribed")
        email = _field(form, "email").strip()
        result = deps.store.subscribe(email)
        if result.action == "invalid":
            return _json_response("invalid")
        if result.action == "send_verify":
            # Per-destination throttle: at most one verify email per address per
            # cooldown so /api/subscribe can't be used to email-bomb victims.
            if deps.store.may_send_verify(result.email, now):
                deps.send_verify(result.email, result.token)
                deps.store.note_verify_sent(result.email, now)
        # send_verify / already_verified (sent or throttled) all return the SAME
        # response (enumeration-safe: never reveal that an email already exists).
        return _json_response("subscribed")

    if path == "/api/verify":
        token = (_field(query, "token") or _field(form, "token")).strip()
        if method == "GET":
            # A bare GET only renders a form; the verify happens on POST, so a mail
            # scanner / link prefetcher that follows the link can't confirm a human.
            return _confirm_form_page(
                "/api/verify", token, "Confirm your subscription",
                "Confirm your subscription",
                '<p>One more step: click below to confirm and start getting Overdue '
                'updates by email.</p>', "Confirm subscription")
        if method == "POST":
            result = deps.store.verify(token)
            if result.status == "verified":
                deps.send_welcome(result.email, result.unsub_token)
                return _page("You're in", "You&rsquo;re subscribed",
                             '<p>Welcome aboard! You&rsquo;ll get an email when '
                             'Overdue&rsquo;s tracker is updated.</p>')
            if result.status == "already":
                return _page("Already confirmed", "Already confirmed",
                             '<p>You&rsquo;re already on the list. Nothing more to do.</p>')
            return _page("Link problem", "This link didn&rsquo;t work",
                         '<p>The confirmation link is invalid or has expired (they last '
                         '48 hours). <a href="/">Sign up again</a> to get a fresh one.</p>',
                         status=400)

    if path == "/api/unsubscribe":
        token = (_field(query, "token") or _field(form, "token")).strip()
        if method == "GET":
            # Bare GET only shows a form; removal is POST (so scanners / prefetchers
            # can't unsubscribe a human by following the link).
            return _confirm_form_page(
                "/api/unsubscribe", token, "Unsubscribe",
                "Unsubscribe from Overdue updates",
                '<p>Click below to stop receiving Overdue update emails.</p>',
                "Unsubscribe")
        if method == "POST":
            # POST = the confirm form OR an RFC 8058 one-click (token in the query).
            deps.store.unsubscribe(token)   # idempotent; same page either way
            return _page("Unsubscribed", "You&rsquo;re unsubscribed",
                         '<p>You will no longer receive Overdue update emails. '
                         'Changed your mind? <a href="/">Re-subscribe anytime</a>.</p>')

    return _page("Not found", "Not found", '<p><a href="/">Go home</a></p>', status=404)


def _field(data: dict, key: str, default: str = "") -> str:
    value = data.get(key, default)
    if isinstance(value, list):
        value = value[0] if value else default
    return value if isinstance(value, str) else default


def _confirm_form_page(action: str, token: str, title: str, heading: str,
                       intro_html: str, button_label: str) -> Response:
    """A page whose only action is a POST form carrying the token. Used so the
    state-changing verify/unsubscribe never fire on a bare GET."""
    safe = escape(token, quote=True)
    body = (
        f'{intro_html}'
        f'<form method="post" action="{action}" style="margin-top:18px">'
        f'<input type="hidden" name="token" value="{safe}">'
        f'<button type="submit" style="background:#2997ff;color:#000;border:0;'
        f'border-radius:980px;padding:11px 20px;font-size:15px;font-weight:600;'
        f'cursor:pointer">{escape(button_label)}</button></form>'
    )
    return _page(title, heading, body)


# --- production wiring -------------------------------------------------------
def _base_url() -> str:
    return os.environ.get("SITE_ORIGIN", "https://overduetracker.org").rstrip("/")


def make_production_deps(db_path: str) -> Deps:
    """Wire the real subscriber store + email-sending callbacks."""
    from emailer import deliver_message, render_verify, render_welcome

    store = SubscriberStore(db_path)
    base = _base_url()

    def send_verify(email: str, token: str) -> None:
        url = f"{base}/api/verify?token={quote(token)}"
        subject, text, html = render_verify(email, url)
        deliver_message(email, subject, text, html, slug=f"verify-{token[:10]}")

    def send_welcome(email: str, unsub_token: str) -> None:
        unsub = f"{base}/api/unsubscribe?token={quote(unsub_token)}"
        subject, text, html = render_welcome(email, unsub)
        deliver_message(email, subject, text, html,
                        slug=f"welcome-{unsub_token[:10]}", list_unsubscribe=unsub)

    return Deps(store=store, send_verify=send_verify, send_welcome=send_welcome,
                rate=RateLimiter())


class SubscribeHandler(BaseHTTPRequestHandler):
    deps: Deps | None = None     # injected by serve()

    def _client_ip(self) -> str:
        # Behind Cloudflare -> Caddy -> this localhost port. Cloudflare sets
        # Cf-Connecting-Ip to the real visitor; trust it because the Caddy site
        # block is pinned to Cloudflare's ranges (trusted_proxies) and the origin
        # is not reachable except through Cloudflare. Fall back to the last
        # X-Forwarded-For hop (Caddy's appended peer) then the socket.
        cf = self.headers.get("Cf-Connecting-Ip")
        if cf:
            return cf.strip()
        xff = self.headers.get("X-Forwarded-For")
        return xff.split(",")[-1].strip() if xff else self.client_address[0]

    def _dispatch(self, method: str, form: dict) -> None:
        u = urlsplit(self.path)
        query = {k: (v if len(v) > 1 else v[0]) for k, v in parse_qs(u.query).items()}
        resp = route(method, u.path, query, form, self._client_ip(),
                     self.deps, time.time())
        body = resp.body if isinstance(resp.body, bytes) else resp.body.encode("utf-8")
        extra = resp.headers or {}
        self.send_response(resp.status)
        if resp.location:
            self.send_header("Location", resp.location)
        self.send_header("Content-Type", resp.content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in extra.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        self._dispatch("GET", {})

    def do_POST(self) -> None:
        # Clamp to [0, MAX_BODY]: a non-numeric, missing, or negative Content-Length
        # must never reach rfile.read() (read(-1) would slurp until EOF, bypassing
        # the cap and tying up a worker thread).
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        length = max(0, min(length, MAX_BODY))
        raw = self.rfile.read(length).decode("utf-8", "replace") if length else ""
        path = urlsplit(self.path).path
        ctype = (self.headers.get("Content-Type") or "").lower()
        if path == "/api/subscribe" or ctype.startswith("application/json"):
            # /api/subscribe speaks JSON (the site's inline fetch). A malformed body
            # yields an empty form -> route() returns {"status": "invalid"}.
            try:
                parsed = json.loads(raw) if raw else {}
            except (TypeError, ValueError):
                parsed = {}
            form = parsed if isinstance(parsed, dict) else {}
        else:
            # verify / unsubscribe POSTs come from the rendered HTML forms.
            form = {k: (v if len(v) > 1 else v[0]) for k, v in parse_qs(raw).items()}
        self._dispatch("POST", form)

    def log_message(self, *args) -> None:
        pass   # stay quiet in the journal


def serve(host: str | None = None, port: int | None = None,
          db_path: str = "data/subscribers.db") -> None:
    host = host or os.environ.get("SUBSCRIBE_HOST", "127.0.0.1")
    port = port or int(os.environ.get("SUBSCRIBE_PORT", "8788"))
    deps = make_production_deps(db_path)
    SubscribeHandler.deps = deps
    httpd = ThreadingHTTPServer((host, port), SubscribeHandler)
    print(f"[subscribe] listening on http://{host}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    serve()
