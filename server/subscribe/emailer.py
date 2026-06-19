"""Message building + the three Overdue email templates.

Builds a multipart email (plain-text + HTML) with Message-ID, Date, From (display
name), Reply-To (a real forwarding alias), and one-click List-Unsubscribe +
List-Unsubscribe-Post (RFC 8058). Three render functions:
  - render_verify(email, verify_url)   -> (subject, text, html)
  - render_welcome(email, unsub_url)   -> (subject, text, html)
  - render_update(update, unsub_url)   -> (subject, text, html)
URLs are built by the caller from SITE_ORIGIN. Delivery goes through notify.deliver
(SMTP-or-dry-run), so a missing SMTP config writes an inspectable .eml instead.

Ported (trimmed) from dc-frontier-events/emailer.py: dropped the weekly digest /
source filtering; kept the From/Reply-To/Message-ID/List-Unsubscribe header build.
"""

from __future__ import annotations

import os
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from html import escape

from notify import deliver


def _safe_header(value: str) -> str:
    """Collapse CR/LF to a space so a header value can never break into extra
    headers (defense in depth: callers already validate the email and build the
    URLs, but build_message is the last line — and Python would otherwise *raise*
    on an embedded newline, crashing the send worker)."""
    return value.replace("\r", " ").replace("\n", " ")


def _from_addr() -> str:
    """SMTP_FROM with a display name, e.g. 'Overdue <updates@mail.overduetracker.org>'.
    If SMTP_FROM already includes a display name (has '<'), use it as-is."""
    raw = os.environ.get("SMTP_FROM", "overdue@localhost")
    return raw if "<" in raw else f"Overdue <{raw}>"


def _addr_domain() -> str:
    raw = os.environ.get("SMTP_FROM", "overdue@localhost")
    inner = raw.split("<")[-1].rstrip(">") if "<" in raw else raw
    return inner.split("@")[-1] or "localhost"


def build_message(to: str, subject: str, text: str, html: str,
                  list_unsubscribe: str | None = None) -> EmailMessage:
    """Assemble a multipart (plain-text + HTML) message. Pure: no IO, fully
    unit-testable. Adds Reply-To (from SMTP_REPLY_TO) and one-click
    List-Unsubscribe headers (RFC 8058) when provided."""
    msg = EmailMessage()
    msg["Subject"] = _safe_header(subject)
    msg["From"] = _from_addr()
    msg["To"] = _safe_header(to)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=_addr_domain())
    reply = os.environ.get("SMTP_REPLY_TO")
    if reply:
        msg["Reply-To"] = reply
    # One-click List-Unsubscribe (RFC 8058): Gmail/Apple render a native control,
    # and bulk-sender requirements are met. The URL must accept POST -- the subscribe
    # service handles POST /api/unsubscribe.
    if list_unsubscribe and list_unsubscribe != "#":
        msg["List-Unsubscribe"] = f"<{_safe_header(list_unsubscribe)}>"
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(text)                       # plain-text alternative
    msg.add_alternative(html, subtype="html")   # preferred HTML body
    return msg


def deliver_message(to: str, subject: str, text: str, html: str,
                    out_dir: str = "out", slug: str = "message",
                    list_unsubscribe: str | None = None) -> tuple[str, str]:
    """Build then deliver (SMTP-or-dry-run) a single email. Returns (mode, target)."""
    msg = build_message(to, subject, text, html, list_unsubscribe=list_unsubscribe)
    return deliver(msg, out_dir, slug=slug)


# --- templates ---------------------------------------------------------------
_HTML_CSS = (
    "font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;"
    "color:#1d1d1f;line-height:1.55;max-width:560px;margin:0 auto"
)


def _wrap_html(heading: str, body_html: str, footer_html: str = "") -> str:
    return (
        f'<div style="{_HTML_CSS}">'
        f'<h1 style="font-size:20px;letter-spacing:-.02em">{heading}</h1>'
        f'{body_html}{footer_html}</div>'
    )


def _unsub_footer(unsub_url: str) -> str:
    safe = escape(unsub_url, quote=True)
    return (
        f'<p style="font-size:13px;color:#86868b;margin-top:28px">'
        f'You are receiving this because you confirmed a subscription to Overdue '
        f'updates. <a href="{safe}">Unsubscribe</a>.</p>'
    )


def render_verify(email: str, verify_url: str) -> tuple[str, str, str]:
    subject = "Confirm your Overdue subscription"
    text = (
        "Confirm your subscription to Overdue updates.\n\n"
        f"Open this link to confirm (expires in 48 hours):\n{verify_url}\n\n"
        "If you didn't sign up, ignore this email. Nothing happens until you confirm."
    )
    safe = escape(verify_url, quote=True)
    html = _wrap_html(
        "Confirm your subscription",
        f'<p>One more step: confirm your email to start getting updates when '
        f'Overdue&rsquo;s frontier-AI safety-commitment tracker changes.</p>'
        f'<p><a href="{safe}" style="display:inline-block;background:#2997ff;'
        f'color:#fff;text-decoration:none;border-radius:980px;padding:11px 20px;'
        f'font-weight:600">Confirm subscription</a></p>'
        f'<p style="font-size:13px;color:#86868b">This link expires in 48 hours. '
        f'If you didn&rsquo;t sign up, ignore this email.</p>',
    )
    return subject, text, html


def render_welcome(email: str, unsub_url: str) -> tuple[str, str, str]:
    subject = "You're in: Overdue updates"
    text = (
        "You're subscribed to Overdue updates.\n\n"
        "You'll get an email whenever the frontier-AI safety-commitment tracker "
        "is updated.\n\n"
        f"Unsubscribe anytime: {unsub_url}"
    )
    html = _wrap_html(
        "You&rsquo;re subscribed",
        '<p>Welcome aboard. You&rsquo;ll get an email whenever Overdue&rsquo;s '
        'frontier-AI safety-commitment tracker is updated.</p>',
        _unsub_footer(unsub_url),
    )
    return subject, text, html


def render_update(update: dict, unsub_url: str) -> tuple[str, str, str]:
    title = str(update.get("title", "Overdue update"))
    body = str(update.get("body", ""))
    date = str(update.get("date", ""))
    origin = os.environ.get("SITE_ORIGIN", "https://overduetracker.org").rstrip("/")
    update_id = str(update.get("id", ""))
    link = f"{origin}/updates#{update_id}" if update_id else f"{origin}/updates"
    subject = f"Overdue update: {title}"
    text = (
        f"{title}\n"
        f"{date}\n\n"
        f"{body}\n\n"
        f"Read on Overdue: {link}\n\n"
        f"Unsubscribe anytime: {unsub_url}"
    )
    safe_link = escape(link, quote=True)
    html = _wrap_html(
        escape(title),
        (f'<p style="font-size:13px;color:#86868b">{escape(date)}</p>'
         f'<p>{escape(body)}</p>'
         f'<p><a href="{safe_link}">Read it on Overdue</a></p>'),
        _unsub_footer(unsub_url),
    )
    return subject, text, html
