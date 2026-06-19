# Milestone 5 — Our own email system (Design)

**Date:** 2026-06-18
**Status:** Approved (brainstorm via the events.emersus.ai blueprint) → spec for review
**Depends on:** M3 (the updates log that gets mailed), M4 (newbox host + domain + Caddy). **Replaces** M4's Buttondown proxy.

## Goal

Own the whole email subscription pipeline — list, double opt-in, unsubscribe, and sending — on newbox, with mail delivered through **Resend** (reusing the existing account) so it lands in inboxes. No SaaS owns the list. **Mirror the battle-tested `dc-frontier-events` (events.emersus.ai) implementation**, trimmed to Overdue's needs.

## Why this shape (the events.emersus.ai blueprint, verified on the box)

`dc-frontier-events` already runs this exact system in production: a SQLite subscriber store, a hardened subscribe server with double opt-in, and an emailer that sends via Resend SMTP from a verified subdomain with one-click `List-Unsubscribe`. We adapt it rather than invent. **Deliverability (the hard part) is solved by copying its recipe:** Resend's warmed IPs + an authenticated sending domain (SPF/DKIM/DMARC) + double opt-in + `List-Unsubscribe` + real `Reply-To`.

## Decisions

1. **Mirror `dc-frontier-events`** — port/adapt `subscribers.py`, `subscribe_server.py`, `emailer.py`/`notify.py`; drop the events-specific bits (profiles, sources, calendar).
2. **Python service** on the box (the box already runs Python; reusing proven code beats a Node rewrite). The static site stays Astro/Node.
3. **Reuse the existing Resend account** — add `overduetracker.org` as a second verified sending domain (its own SPF/DKIM/DMARC). Recommend a dedicated send subdomain (`mail.overduetracker.org`) to isolate reputation. Transport = **Resend SMTP** (`smtplib` + STARTTLS), creds in a root-only env file.
4. **Replace M4's Node Buttondown proxy** (`server/subscribe/*.mjs`) entirely.

## Architecture

```
browser ─ POST /api/subscribe ─► Caddy ─► Python subscribe_server (newbox)
                                              ├─ SQLite subscribers.db (pending→verified→unsubscribed)
                                              └─ emailer ─► Resend SMTP (From updates@mail.overduetracker.org, DKIM)
GET/POST /api/verify?token   → confirm (POST only) → welcome email
GET/POST /api/unsubscribe?token → remove (POST only; RFC 8058 one-click target)

new updates.ts entry ─► (CI or manual) send_update ─► emailer ─► confirmed subscribers (with unsubscribe link)
```

## Components

### 1. `subscribers.py` — SQLite store (port)
Schema: `email`, `status` (`pending|verified|unsubscribed`), `verify_token`, `unsub_token`, timestamps. Tokens `secrets.token_urlsafe(32)`; pending expires 48h. Methods: `subscribe(email)`, `verify(token)`, `unsubscribe(token)`, `confirmed()` (iterator for sends). Pure, unit-tested.

### 2. `subscribe_server.py` — hardened HTTP (port)
A pure, testable `route(method, path, form, deps)` + a thin `http.server` handler. Endpoints (mirroring events):
- `POST /api/subscribe` — `email` (+ honeypot `website`). **Enumeration-safe**: always responds "check your inbox". Strict rate limit. Sends a verify email.
- `GET /api/verify?token` → a confirm **form**; `POST /api/verify` → mark verified → welcome email → "you're in" page. (State changes on POST only → scanners/prefetchers can't act.)
- `GET /api/unsubscribe?token` → a confirm form; `POST /api/unsubscribe?token` → remove (also the RFC 8058 one-click target).
- Generous rate limit on read/token endpoints; strict on subscribe.

### 3. `emailer.py` — message building + Resend SMTP (port)
Builds multipart (HTML + plaintext) with `Message-ID`, `Date`, `From` (display name), **`Reply-To`** (a real forwarding alias), and one-click **`List-Unsubscribe` + `List-Unsubscribe-Post`** (RFC 8058). Three templates: **verify**, **welcome**, **update** (a new updates-log entry, with the unsubscribe link). Sends via `SMTP_HOST=smtp.resend.com` STARTTLS, `SMTP_USER=resend`, `SMTP_PASS=<resend key>` — all from env. Dry-run writes an `.eml` when SMTP unset (testable).

### 4. `send_update.py` — send-on-publish
A command that takes the latest (or a given) `UPDATES` entry, renders the update email, and sends to `subscribers.confirmed()`. Triggered from CI on a new updates entry (a step in the deploy, gated so it only fires when `updates.ts` changed) or run manually. Idempotency: a `sent_updates` marker (by update `id`) so re-runs don't double-send.

### 5. Frontend (mostly already built)
`Subscribe.astro` (from M4) posts to `/api/subscribe`; its `statusMessage('subscribed')` already says "check your inbox to confirm" — fits double opt-in. Verify/unsubscribe pages are server-rendered by the Python service (simple HTML). The Pages backup keeps showing the apex link.

### 6. Caddy + systemd (runbook)
Caddy `handle /api/*` → `reverse_proxy 127.0.0.1:8788` (the Python service). systemd unit runs `python -m subscribe_server` with the root-only env file. Mirror the events service unit.

## Resend + DNS (reuse the account)
- Add `overduetracker.org` (recommend send subdomain `mail.overduetracker.org`) as a verified domain in the existing Resend account → it emits SPF, DKIM, DMARC records.
- I add those records in **Cloudflare** (browser). Env file on the box (`/etc/overdue-subscribe.env`, chmod 600): `SMTP_HOST/USER/PASS`, `SMTP_FROM="Overdue <updates@mail.overduetracker.org>"`, `SMTP_REPLY_TO`, `SITE_ORIGIN=https://overduetracker.org`.

## Testing
- **pytest** for the Python service (mirror events tests): `subscribers` store state machine, `route()` with fakes (subscribe/verify/unsubscribe, honeypot, enumeration-safety, rate limit), emailer dry-run renders verify/welcome/update with `List-Unsubscribe`. CI gets a Python test step.
- Frontend `statusMessage` stays in vitest.
- Manual E2E at go-live: subscribe → verify email arrives **in inbox** (not spam) → confirm → welcome; publish an update → confirmed list receives it; unsubscribe works.

## File structure
**Create:** `server/subscribe/` as a Python package — `subscribers.py`, `subscribe_server.py`, `emailer.py`, `send_update.py`, `pyproject.toml`/`requirements.txt`, `tests/` (pytest). `docs/runbooks/m5-email.md`.
**Remove:** the M4 Node Buttondown proxy — `server/subscribe/subscribe.mjs`, `index.mjs`, `package.json`, and `tests/subscribe.test.ts`'s Buttondown cases (keep `statusMessage`).
**Modify:** `.github/workflows/deploy-newbox.yml` (add a Python test step + a gated `send_update` on updates changes), `CHANGELOG.md` (M5 entry, same commit), `README.md`.

## Execution (who does what)
- **Resend (browser):** add the domain (your account) — I can drive it; you confirm.
- **Cloudflare (I drive):** add SPF/DKIM/DMARC records.
- **Box (`ssh newbox`):** deploy the Python service to `/opt/overdue-subscribe`, env file, systemd unit; **Caddy `/api/*` route — your sign-off.**
- **You:** Resend account is yours (we reuse it); confirm the send subdomain choice.

## Risks / tradeoffs
- **Polyglot repo** (Python service + Node site) and **two test stacks** (pytest + vitest). Accepted: reusing proven code beats a risky Node rewrite, and the box already runs Python.
- **Deliverability still depends on the DNS auth being correct** — mitigated by copying the events setup exactly and a "lands in inbox" manual check at go-live.
- **We now own compliance** (unsubscribe, List-Unsubscribe, double opt-in) — all inherited from the events blueprint.
- **Sending reputation** is ours to keep clean — double opt-in + low volume + good content protect it.
