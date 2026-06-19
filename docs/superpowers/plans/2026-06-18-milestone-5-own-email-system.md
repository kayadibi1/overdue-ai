# Milestone 5 — Our own email system — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Checkbox (`- [ ]`) steps. **This is a faithful PORT** of the proven `dc-frontier-events` email stack on newbox — read those source files and adapt, don't reinvent.

**Goal:** An owned email pipeline for Overdue — SQLite list + double opt-in + unsubscribe + send-on-publish — sending via Resend SMTP, ported/trimmed from `dc-frontier-events`. Replaces M4's Buttondown proxy.

**Source to port (read on the box):** `ssh newbox`, `/opt/dc-frontier-events/aggregator/{subscribers,subscribe_server,emailer,notify}.py` (+ their `tests/test_*`).

**Trim rule:** drop everything events-specific — `source_prefs`, `SubscriberProfile` (name/company/role/position/visitor_id), calendar/`digest`, `--preferences`. Keep: email, status, verify/unsub tokens, timestamps, `last_verify_sent_at`, the verify cooldown, enumeration-safety, honeypot, rate limits, POST-only state changes, `List-Unsubscribe`, Reply-To, Resend SMTP.

**Tech:** Python 3 stdlib (`sqlite3`, `http.server`, `smtplib`, `email`) — no pip deps. pytest for the service; vitest stays for the site.

**Packaging:** convert the events **relative imports** (`from .subscribers import`) to **absolute** (`from subscribers import`) so the flat `/opt/overdue-subscribe` deploy + pytest both resolve modules; run on the box as `python3 -m subscribe_server` / `python3 -m send_update` from that dir. `pyproject.toml` sets `[tool.pytest.ini_options]` `pythonpath = ["."]` so `pytest server/subscribe` finds them.

**Spec:** `docs/superpowers/specs/2026-06-18-m5-own-email-system-design.md`

---

### Task 1: Scaffold the Python package; remove the Buttondown proxy

**Files:** Create `server/subscribe/__init__.py`, `server/subscribe/pyproject.toml` (or `requirements-dev.txt` with pytest), `server/subscribe/tests/__init__.py`. Delete `server/subscribe/subscribe.mjs`, `server/subscribe/index.mjs`, `server/subscribe/package.json`.

- [ ] **Step 1:** `git rm server/subscribe/subscribe.mjs server/subscribe/index.mjs server/subscribe/package.json`
- [ ] **Step 2:** Create the package + a `pyproject.toml` declaring `pytest` as the only dev dep, `requires-python = ">=3.11"`.
- [ ] **Step 3:** Verify `python3 -m pytest server/subscribe -q` runs (0 tests, exit 0).
- [ ] **Step 4:** Commit `chore(m5): scaffold python subscribe package; drop buttondown proxy`.

---

### Task 2: Port `subscribers.py` (trimmed) + tests (TDD)

**Files:** Create `server/subscribe/subscribers.py`, `server/subscribe/tests/test_subscribers.py`

Port the SQLite store + state machine from the source, with the trimmed DDL:
```
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL,              -- pending | verified | unsubscribed
  verify_token TEXT, unsub_token TEXT,
  created_at TEXT, verified_at TEXT, unsub_at TEXT,
  last_verify_sent_at REAL
);
```
Keep methods (signatures trimmed of `sources`/`profile`): `subscribe(email) -> SubscribeResult`, `may_send_verify`/`note_verify_sent` (300s cooldown), `verify(token) -> VerifyResult`, `unsubscribe(token) -> bool`, and add `confirmed() -> Iterator[(email, unsub_token)]` for sends. Keep WAL + the write lock, `secrets.token_urlsafe(32)`, 48h pending TTL, enumeration-safe `subscribe`.

- [ ] **Step 1: Write failing pytest** (`test_subscribers.py`) covering: new→pending (`send_verify` + token); verify(token)→verified; re-verify→`already`; expired token (created >48h)→`invalid`; unsubscribe(token)→removed/unsubscribed; re-subscribe after unsubscribe restarts pending; `valid_email` rejects junk/oversize/`a@b`; verify cooldown (`may_send_verify` false within 300s); `confirmed()` yields only verified. Use an in-memory/temp-file db path.
- [ ] **Step 2:** Run `pytest server/subscribe/tests/test_subscribers.py` → FAIL (module missing).
- [ ] **Step 3:** Port `subscribers.py` trimmed (read the source; remove `source_prefs`/`profile`/`normalize_profile`/role columns; keep the rest). Add `confirmed()` and `unsubscribe()` (the source has the unsubscribe path in the later half — read it).
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat(m5): port subscriber store (sqlite double opt-in) + tests`.

---

### Task 3: Port `subscribe_server.py` `route()` (trimmed) + tests (TDD)

**Files:** Create `server/subscribe/subscribe_server.py`, `server/subscribe/tests/test_subscribe_server.py`

Port the **pure `route(method, path, form, deps)`** + the `ThreadingHTTPServer` shell. Endpoints: `POST /api/subscribe` (email + honeypot `website`; enumeration-safe "check your inbox"; strict rate limit; calls `send_verify`), `GET /api/verify` (form) + `POST /api/verify` (→verified→`send_welcome`→"you're in"), `GET /api/unsubscribe` (form) + `POST /api/unsubscribe` (remove; RFC 8058 one-click). Trim: drop `/api/calendar.ics`, `/api/preferences`, profile/sources parsing. Keep the two rate limiters, honeypot short-circuit, and POST-only state changes.

- [ ] **Step 1: Write failing pytest** with fake `deps` (in-memory store + recording `send_verify`/`send_welcome`): subscribe returns "check your inbox" + calls send_verify; honeypot filled → silently OK, no send; GET verify/unsubscribe render a form and DON'T mutate; POST verify with good token → verified + welcome; POST unsubscribe → removed; subscribe rate limit trips after N.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Port `subscribe_server.py` trimmed (read source).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(m5): port hardened subscribe server (route + handler) + tests`.

---

### Task 4: Port `emailer.py` + `notify.py` (trimmed) + 3 templates + tests (TDD)

**Files:** Create `server/subscribe/emailer.py`, `server/subscribe/notify.py`, `server/subscribe/tests/test_emailer.py`

Port `notify.py` (smtplib + STARTTLS; `SMTP_HOST/USER/PASS`, dry-run writes `.eml` when unset) verbatim — it's transport-only. Port `emailer.py`'s message-building (`From` via `SMTP_FROM`, `Reply-To` via `SMTP_REPLY_TO`, `Message-ID`, `Date`, one-click `List-Unsubscribe` + `List-Unsubscribe-Post`), trimming the digest. Provide three render functions: `render_verify(email, verify_url)`, `render_welcome(email, unsub_url)`, `render_update(update, unsub_url)` — each returns (subject, text, html). URLs built from `SITE_ORIGIN` env.

- [ ] **Step 1: Write failing pytest**: each render returns non-empty subject/text/html; the update email contains the update title + an unsubscribe URL; `build_message()` sets `List-Unsubscribe`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, `Reply-To`, and a `From` with display name; dry-run `deliver()` (SMTP unset) writes an `.eml` and sends nothing.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Port `notify.py` + `emailer.py` trimmed; add the three render functions.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(m5): port emailer + Resend SMTP transport (List-Unsubscribe, Reply-To) + tests`.

---

### Task 5: `updates.json` endpoint + `send_update.py` (send-on-publish) + tests

**Files:** Create `src/pages/updates.json.ts` (Astro), `server/subscribe/send_update.py`, `server/subscribe/tests/test_send_update.py`

`updates.json.ts` mirrors `commitments.json.ts`: `prerender`, emits `{ updates: sortUpdates(UPDATES) }`. `send_update.py` reads a deployed `updates.json` (path arg, default `/var/www/overdue/updates.json`), picks the newest (or `--id`) entry, and sends `render_update` to `store.confirmed()` — **idempotent** via a `sent_updates(id)` table (skip if already sent). `--dry-run` prints recipients without sending.

- [ ] **Step 1: Write failing pytest**: given a temp updates.json + a store with 2 verified + 1 pending, `send_update(dry_run)` targets only the 2 verified; running twice for the same id sends once (idempotent marker); `--id` selects a specific entry.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `updates.json.ts` + `send_update.py`.
- [ ] **Step 4:** Run → PASS; `npm run build` emits `dist/updates.json`.
- [ ] **Step 5:** Commit `feat(m5): updates.json endpoint + idempotent send-on-publish + tests`.

---

### Task 6: Frontend cleanup

**Files:** Modify `tests/subscribe.test.ts` (remove Buttondown cases, keep `statusMessage`); `src/components/Subscribe.astro` unchanged (already posts `/api/subscribe`).

- [ ] **Step 1:** Strip the `normalizeEmail`/`mapButtondownResponse`/`subscribe` describe blocks (they reference the deleted `.mjs`); keep the `statusMessage` block.
- [ ] **Step 2:** `npm test` → green (vitest no longer imports the removed module).
- [ ] **Step 3:** Commit `chore(m5): drop buttondown frontend tests; keep statusMessage`.

---

### Task 7: CI — Python tests + gated send-on-publish

**Files:** Modify `.github/workflows/deploy-newbox.yml`

- [ ] **Step 1:** Add a step after `npm test`: set up Python 3.11 + `pip install pytest` + `pytest server/subscribe -q`.
- [ ] **Step 2:** After the rsync deploy step, add a **gated** step: if `git diff --name-only ${{ github.event.before }} ${{ github.sha }}` includes `src/data/updates.ts` (skip if `before` is all-zeros / diff fails), `ssh` the box and run, sourcing the env file: `cd /opt/overdue-subscribe && set -a && . /etc/overdue-subscribe.env && set +a && python3 -m send_update --latest --updates /var/www/overdue/updates.json` (uses the box's subscribers.db + SMTP env). Guard on `env.DEPLOY_KEY != ''` like the deploy step.
- [ ] **Step 3:** `node`-validate the YAML (no tabs); commit `ci(m5): run pytest + gated send-on-publish on updates changes`.

---

### Task 8: Runbook + service deploy

**Files:** Create `docs/runbooks/m5-email.md`

Document (mirroring the events service): add `overduetracker.org` (send subdomain `mail.overduetracker.org`) to the **existing Resend account** → SPF/DKIM/DMARC records (I add in Cloudflare); `/etc/overdue-subscribe.env` (root-only): `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_PASS=<resend key>`, `SMTP_FROM="Overdue <updates@mail.overduetracker.org>"`, `SMTP_REPLY_TO=`, `SITE_ORIGIN=https://overduetracker.org`; rsync `server/subscribe/` → `/opt/overdue-subscribe`; systemd unit `overdue-subscribe.service` (`python3 -m subscribe_server`, port 8788, EnvironmentFile); Caddy `handle /api/*` → `reverse_proxy 127.0.0.1:8788` (mirror events' AOP block — **your sign-off**); verify the verify email lands **in inbox** (check spam).

- [ ] **Step 1:** Write the runbook. **Step 2:** Commit `docs(m5): own-email go-live runbook`.

---

### Task 9: README + CHANGELOG (with the wave)

**Files:** Modify `README.md`, `CHANGELOG.md`

- [ ] **Step 1:** README Follow: email is our own double-opt-in list (Resend transport), not Buttondown.
- [ ] **Step 2:** CHANGELOG `## 2026-06-18 · M5 — our own email system`: SQLite list + double opt-in + one-click unsubscribe ported from dc-frontier-events; Resend SMTP from a verified subdomain (SPF/DKIM/DMARC) + List-Unsubscribe = inbox delivery; send-on-publish; Buttondown removed; pytest + vitest both green.
- [ ] **Step 3:** Full: `pytest server/subscribe -q` + `npm test` + `npm run build` all green.
- [ ] **Step 4:** Commit `docs(m5): README + CHANGELOG for the own-email system`.

---

## Self-Review checklist (run before building)
- Coverage: store ✅(T2) · server ✅(T3) · emailer/transport ✅(T4) · send-on-publish ✅(T5) · frontend ✅(T6) · CI ✅(T7) · runbook ✅(T8) · changelog-with-wave ✅(T9).
- Contract consistency: port 8788 (server, Caddy, systemd); `SMTP_*` env names match notify.py + the runbook; `confirmed()` shape used by `send_update`; `/api/subscribe` matches `Subscribe.astro`'s action + statusMessage states; idempotency marker prevents double-send.
- Trim completeness: no `source_prefs`/`profile`/calendar/`digest` references survive the port.
