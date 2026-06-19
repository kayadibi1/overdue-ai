# Changelog

Human-facing history of Overdue, an accountability tracker for frontier AI safety commitments. Newest first. Fine-grained detail lives in git; this file records each wave of work.

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
