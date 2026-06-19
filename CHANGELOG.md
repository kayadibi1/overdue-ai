# Changelog

Human-facing history of Overdue, an accountability tracker for frontier AI safety commitments. Newest first. Fine-grained detail lives in git; this file records each wave of work.

## 2026-06-18 · M5 — our own email system

- **Owned double-opt-in list:** a Python `subscribe_server` on the box (`server/subscribe/`) backs the on-site form with a SQLite store (`pending → verified → unsubscribed`) ported from `dc-frontier-events`. `/api/subscribe` speaks JSON to the inline fetch and is **enumeration-safe** (a valid email always returns `subscribed`, new or existing); verify/unsubscribe are server-rendered **form pages** whose state changes fire on **POST only**, so mail scanners and link prefetchers can't confirm or unsubscribe a human. Honeypot, per-IP rate limits, a 300s per-address verify cooldown, and a 48h pending TTL come along.
- **Resend SMTP from a verified subdomain:** the emailer sends verify / welcome / update mail via `smtplib` + STARTTLS (`smtp.resend.com`) from `mail.overduetracker.org` (SPF/DKIM/DMARC), with `Reply-To` and one-click **`List-Unsubscribe` + `List-Unsubscribe-Post`** (RFC 8058) — the recipe that lands mail in the inbox. No SMTP creds → it degrades to inspectable dry-run `.eml` files.
- **Send-on-publish:** a new `src/data/updates.ts` entry → `/updates.json` (prerendered, mirrors `commitments.json`) is deployed to the box, then CI runs `send_update` to mail the latest entry to confirmed subscribers. **Idempotent** via a `sent_updates(id)` marker so a re-run never double-sends; `--dry-run` lists recipients.
- **Buttondown removed:** the M4 Node proxy (`server/subscribe/*.mjs`) and its frontend tests are gone; the site no longer hands the list to a SaaS.
- **Two test stacks, both green:** the Python service is unit-tested with **pytest** (store state machine, `route()` with fakes, emailer dry-run + headers, idempotent send) and runs as a CI step; the site stays on **vitest**.
- Trimmed all events-specific bits during the port (source preferences, subscriber profiles, calendar). pytest + vitest both green; apex + `PAGES=1` builds both green (build emits `dist/updates.json`). **Go-live (Resend domain + DNS + Caddy `/api/*` + systemd) is executed separately via `docs/runbooks/m5-email.md`.**

## 2026-06-18 · M4 — custom domain + newbox host + inline subscribe (repo side)

- **Custom domain + apex move:** `astro.config` is env-driven — apex `overduetracker.org` (base `/`) by default, with `PAGES=1` keeping the GitHub Pages backup building at `/overdue-ai`. Canonical links pinned to the apex on every page so the backup never competes in search.
- **CI deploy to newbox:** a `deploy-newbox.yml` Action builds and `rsync`s `dist/` to the box over SSH (dedicated deploy key); the box serves static files behind Cloudflare/AOP.
- **Inline email subscribe:** a small Node service (`server/subscribe/`) proxies signups to the Buttondown API with the key server-side; the page fetches it same-origin for inline status, no redirect. Pure logic (`normalizeEmail` / `mapButtondownResponse` / `subscribe` / `statusMessage`) is unit-tested; the Pages backup shows an apex link instead of a dead form.
- **Go-live runbooks** (`docs/runbooks/`) for the Cloudflare + box + Buttondown steps.
- Gauntlet (spec → Codex → plan → self-review ×2) caught real bugs pre-build: `absUrl()` breaking the same-origin subscribe action, a body-cap that could double-send, an implicit service-deploy path, and a per-request (vs startup) API-key check. Verified the Buttondown API contract (host `api.buttondown.com`, field `email_address`) against the docs.
- 44 tests green; apex + `PAGES=1` builds both green. **Go-live (Cloudflare/box/Buttondown) is executed separately via the runbooks.**

## 2026-06-18 · M3 — updates log + RSS feed + launch writeup

- **Curated updates log** (`src/data/updates.ts`): a typed, hand-written stream of "what changed" — the single source the feed (and M4's email) both render from. Helper `sortUpdates` + integrity tests (unique ids, real UTC calendar dates, valid commitment refs).
- **`/updates` page** + a "Latest updates" block on the homepage; entries deep-link to the commitments they reference (new `id` anchors on cards).
- **Hand-rolled RSS feed** at `/feed.xml` — a pure, unit-tested `renderFeed` (+ `escapeXml`), correct under the `/overdue-ai` base path, with autodiscovery `<link>`s on every page.
- **Repositioned on a prior-art scan:** methodology's "How Overdue differs" cites The Midas Project (Seoul Tracker + Watchtower), notes AI Lab Watch is unmaintained since Sept 2025, and frames the wedge — all commitment regimes + a live upcoming/overdue clock, kept current.
- **Launch writeup** drafted (`docs/launch/2026-06-18-overdue-launch.md`) for Substack.
- Gauntlet (spec → Codex review → plan → self-review ×2) caught real bugs pre-build: base-path-relative hrefs, a missing `<lastBuildDate>`, a date test that accepted `2026-02-31`, and commitment links with no anchor targets. 39 tests green.
- Email subscribe, the `overduetracker.org` domain, and the newbox move are deferred to **M4**.

## 2026-06-18 · M2 — the watcher (freshness)

- **Weekly source watcher.** New GitHub Action (Mondays 09:17 UTC + manual `workflow_dispatch`) fetches 5 watched lab/regulatory source pages, diffs the visible text against a stored snapshot, and files a **"Source changed: …"** review issue (with the new text) when a page moves meaningfully.
- **Deadline reminders.** Opens a **"Deadline check: …"** issue for any unresolved lab commitment coming due (within +30 days, or up to 14 days past) so the dataset gets reviewed on time.
- **Pure, tested core** (`src/watcher/core.ts`): `extractText` / `hashText` / `diffSummary` / `dueDeadlines`, with 8 unit tests (29 total green). Runner (`scripts/watch.ts`) uses `tsx` + `cheerio`, a real `--dry-run` mode, a browser User-Agent, fetch timeout + 2 MB cap, and deduped issues via HTML-comment markers.
- **Data integrity:** state + snapshots are persisted **only after** issues are filed, so a failed API call can never mark a source "seen" without its issue. The watcher only ever opens issues — it never edits the dataset itself.
- **No redeploy loop:** `deploy.yml` now ignores `.watcher/**`, `docs/**`, and `**.md`, so the watcher's state commits don't rebuild the site.
- Verified live: baseline run recorded 5 sources + created the `watcher` label, second run was idempotent, neither triggered a redeploy.
- Gauntlet (spec → Codex review → plan → self-review ×2) caught real issues before build: SPA pages that would never diff (excluded), OpenAI blocking the bot UA, the persist-before-issue bug, and a same-day deadline rounding disagreement with the board.

## 2026-06-18 · M1 — credible reference

- **Identity:** reframed the board as **"promises *they* made"** — commitments the labs themselves stated, not third-party predictions.
- **Two tracks.** Added `track: 'lab' | 'regulatory'` to the data model. Lab promises are scored on the board up top; regulatory milestones (e.g. EU AI Act dates) are shown **beneath**, countdown-only, and are never marked "overdue".
- **Coverage:** grew the lab-promise set to ~24 web-verified rows (neutral tone, sourced, `contested` flags where appropriate, no padding); reclassified EU AI Act items as regulatory.
- **`regulatoryLabel`** helper: future deadline → "in N days", past → "in force since <date>".
- **Methodology page:** added "What we include" inclusion criteria and a "Related trackers" section; dropped any "first/only" claim.
- **Post-deploy fact-check:** replaced a dead UK AISI source, corrected framing (only DeepMind had UK AISI model access as of Apr 2024), deferred EU Omnibus dates pending the Official Journal, softened over-claims, and removed a near-duplicate row.

## 2026-06-18 · Initial build

- **Static site** scaffolded with Astro 5 + TypeScript + Vitest. Light theme.
- **Pure status logic** (`src/lib/status.ts`): `computeStatus`, `liveLabel`, `relativeTime`, `summarize`, `sortByUrgency` — all unit-tested, no DOM.
- **Seed dataset** of frontier-lab commitments with data-integrity tests (required fields, sourced evidence URLs).
- **UI:** `StatusChip`, `CommitmentCard`, `SummaryStats`; board page; live countdown timers + a client-side filter/sort island.
- **Methodology page**, an open-data JSON endpoint, `README`, and `LICENSE`.
- **Deploy:** GitHub Pages CI (`deploy.yml`) — live at https://kayadibi1.github.io/overdue-ai/
- Built through a spec → plan → Codex adversarial review → self-review gauntlet, with web-verified data curation throughout.
