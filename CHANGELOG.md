# Changelog

Human-facing history of Overdue, an accountability tracker for frontier AI safety commitments. Newest first. Fine-grained detail lives in git; this file records each wave of work.

## 2026-06-19 · UI/UX polish

A visual/interaction pass from a live browser review (desktop + mobile, seven page types). No new features or data changes. Specs in `docs/superpowers/specs/2026-06-19-ui-ux-polish-design.md`.

- **Subscribe form styled.** The signup — the conversion point — was rendering as raw browser-default widgets (no `.subscribe` CSS existed). Now a styled input (border, radius, focus ring) and an accent pill **Subscribe** button via a new shared `.btn` / `.btn--ghost` system (also applied to the table **Reset** and the new citation **Copy**).
- **Scorecard reads at a glance + is honestly interactive.** The status counts now use the existing semantic tokens (overdue/missed red, upcoming blue, met green, partial amber, pending grey) instead of all-black, and carry a "Tap any metric to filter the board" cue. Fixed an **a11y bug**: lab pages reused the `role="button"` scorecard with no handler (dead focusable controls) — `SummaryStats` gained an `interactive` prop and lab pages now render plain, non-focusable stats.
- **Explore table is more legible.** Sortable headers show a faint `⇅` hint (replaced by `▲`/`▼` when active), rows highlight on hover, the Committed column no longer wraps, and the Commitment column has more room. (The Deadline column still wraps — it can hold long trigger text.)
- **Detail page.** The timeline RULING now reads title-cased (`Met`, matching the chip); the citation gained a working **Copy** button (`scripts/cite.ts`, clipboard with a selection fallback); and deep pages (`/c/…`, `/labs/…`) gained a compact footer nav (Board · Table · Methodology · Updates · Corrections · JSON · CSV) so they aren't dead-ends.
- **Favicon.** Added `public/favicon.svg` (a red "overdue clock") + a base-aware `<link rel="icon">` on every page, ending the per-page `/favicon.ico` 404.
- **"Contested" quieted** from amber to muted grey — it appears on many cards, and an alarm colour on most rows stops being a signal. (The flag's threshold is editorial and unchanged.)
- Scope notes: skipped a shared-layout refactor (per-page edits instead) and wide-screen re-centering (the body is already `max-width:920px; margin:0 auto`). 52 vitest + 40 pytest green (regression guard); apex + `PAGES=1` builds green (49 pages); verified in-browser incl. a caught + fixed table-overflow regression.

## 2026-06-19 · Review remediation — correctness, a11y & hardening

Fixes from a 5-agent comprehensive codebase review (no new features).

- **HIGH — resolved triggers no longer contradict their own chip:** a trigger commitment that has been ruled (Met/Missed/Partial but `deadline: null`) was rendering "awaiting *{trigger}*" — flatly contradicting its status chip on ~10 live rows. `relativeTime` now gates the resolved branch on `resolvedOn` alone and renders "resolved *{date}*" (or "resolved N days early/late / on time" when a deadline exists). Genuinely pending triggers still read "awaiting …".
- **MED — deterministic urgency sort:** `sortByUrgency` compared `NaN` for resolved-but-deadline-less rows; replaced with a finite comparator (deadline-desc → `resolvedOn` → `id`) so order is stable.
- **Feed robustness:** `escapeXml` now strips XML-1.0-illegal control chars (keeping tab/newline/return) so a stray control byte can't make the RSS non-well-formed; `feed.xml.ts` builds item links from `CANONICAL_ORIGIN`, so even the `PAGES=1` backup feed points at the apex. `/updates` "Related" links now resolve to `/c/<id>` detail pages instead of dead homepage anchors.
- **Explore-table accessibility:** sortable column headers are now keyboard-operable `<button>`s with `scope="col"` and live `aria-sort` feedback (were mouse-only `<th>` click targets).
- **Email service hardening (defense in depth):** `build_message` collapses CR/LF in `Subject`/`To`/`List-Unsubscribe` so a future newline-bearing value can't inject extra headers (Python would otherwise *raise* mid-send); the inputs are already validated/curated, this is the last line.
- **CI deploy guard:** the `rsync --delete` mirror now `--exclude='.well-known/'`, so a deploy can't wipe ACME http-challenge or hand-placed verification files the build never produces.
- **Stronger data tests + docs:** `data.test.ts` now asserts real UTC calendar dates on every date field, `http(s)` + dotted-host evidence URLs, and the `resolvedOn` ⇔ `resolution` (and `resolvedOn ≥ committedOn`) invariants; added a `commitmentsByLab` grouping/track-exclusion test and `escapeXml` / read-rate-limit / header-injection tests. Runbooks corrected: `m4-hosting` documents the right `rrsync` forced-command pattern and the dual-use-key conflict with send-on-publish; `m4-subscribe` is banner-marked **SUPERSEDED** (Overdue runs its own Python email service, not Buttondown).
- 52 vitest + 40 pytest tests green; apex + `PAGES=1` builds both green (49 pages).

## 2026-06-19 · M7 — coverage (data breadth)

- **Backed the "all regimes / all labs" claim** by adding 6 web-verified, sourced commitment rows (lab rows 23 → 29) at the project's strict accuracy bar (specific + dated + lab-signed + rock-solid source + contested-flagged; no padding):
  - **Amazon** — Seoul framework by Paris → met (Frontier Model Safety Framework, 2025-02-09) — first Amazon row.
  - **Mistral** — Seoul framework by Paris → missed, contested (absent from METR's published-policy index) — first Mistral row.
  - **xAI** — Seoul framework by Paris → missed, contested (watermarked draft, doc-dated 2025-02-20, ~10 days late) — a distinct 2nd xAI deadline.
  - **White House 2023** — model-weight security → missed; third-party vulnerability reporting → partial; public capability/limitations reporting → partial/contested (rulings from the Stanford study, arXiv 2508.08345). Now 5/8 White House commitments tracked.
- Each candidate came from a dedicated web-research agent, was curated against the no-padding bar (excluded OpenAI-Seoul, WH info-sharing, EU code-signings, non-enum signatories), then **adversarially fact-checked** (a second agent re-verified every date, source, and ruling).
- 45 tests green; 49 pages built.

## 2026-06-19 · M6 — depth & credibility

- **Per-lab report-card pages** (`/labs/<slug>`): each lab's commitments with its status counts (reusing `SummaryStats`) and a derived **kept-rate** (`met ÷ resolved`) always shown *with* the underlying counts and formula, so a single percentage can't be cited out of context (the CAT / GovTrack pattern).
- **Per-commitment detail pages** (`/c/<id>`): a four-stage **status timeline** (committed → due → evaluated → ruling) where each stage carries a `{label, done}` flag so unresolved stages render ghosted rather than falsely "done"; the surfaced **provenance** (`notes`, "Why this ruling"); the source, `committedOn`, an "as of" date, any related updates, and a ready-to-paste **citation**.
- **Trust layer:** every card and detail page now carries its source and an **"as of"** date (per-row `lastChecked` overriding a global `DATA_AS_OF`); methodology gains a **"Data, license & how to cite"** section; the dataset is released **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (`LICENSE-DATA`) while the code stays MIT.
- **CSV export** (`/commitments.csv`): an RFC 4180 serializer (commas/quotes/newlines escaped) alongside the existing JSON, with `description` and `notes` columns.
- **Explore table** (`/table`): a dense, **sortable + filterable** view of every commitment (lab / status / text), each row linking to its detail page; the Lab cell links to a lab page only when one exists.
- **Corrections page** (`/corrections`): lists `UPDATES` with the new `kind: 'correction'`, newest-first, with an empty-state until the first one — out-transparenting the trackers it borrows from.
- **Clickable scorecard:** homepage status counts are now keyboard-accessible filter buttons that set the board's status filter and scroll to it; the homepage also links to the table, per-lab pages, and the data downloads.
- Two optional, backward-compatible data fields only (`Commitment.lastChecked?`, `Update.kind?`) plus `site.ts` `DATA_AS_OF`; new pure helpers (`labs.ts` slug/group/keptRate, `csv.ts`) are TDD'd; existing helpers (`summarize` / `sortByUrgency` / `computeStatus` / `StatusChip` / `CommitmentCard` / `sortUpdates`) are reused, not reimplemented. Borrowed patterns from Climate Action Tracker, PolitiFact, Net Zero Tracker, Our World in Data, and GovTrack.
- 45 tests green; apex + `PAGES=1` builds both green (now emitting 29 `/c` pages, 7 `/labs` pages, `/table`, `/corrections`, and `/commitments.csv`).

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
