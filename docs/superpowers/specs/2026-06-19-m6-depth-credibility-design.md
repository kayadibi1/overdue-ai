# Milestone 6 — Depth & credibility (Design)

**Date:** 2026-06-19
**Status:** Spec for review
**Depends on:** M1 (data/board), M3 (updates log), live site. Borrowed patterns from Climate Action Tracker, PolitiFact, Net Zero Tracker, Our World in Data, GovTrack.

## Goal

Make Overdue read like a *living institution* rather than a single board, by borrowing the patterns that recur across the best public trackers: **per-lab pages**, **per-commitment detail pages with a status timeline**, a **trust layer** (source + last-verified + cite + license + data download), an **explore table view**, surfaced **provenance notes**, and a **corrections page**.

## Verified assumptions (read from the codebase, not assumed)

- **Data model** (`src/lib/types.ts`): `Commitment` has `id, lab, track, title, description, category, committedOn, deadlineType, deadline, triggerText?, resolution, resolvedOn, evidenceUrl, sourceLabel, contested?, notes?`. `LABS` = 9 labs. `Status` = met/missed/partial/overdue/upcoming/pending. **29 rows** (23 lab + 6 regulatory).
- **`notes` is already the provenance/ruling-rationale field** — populated on 26/29 rows. → "provenance note" = **surface `notes`**, no new field.
- **`status.ts`** gives `computeStatus`, `summarize(list,now) → Record<Status,number>`, `sortByUrgency`, `relativeTime`, `regulatoryLabel`. → report-card math is free.
- **`SummaryStats.astro`** already renders the status counts (with `data-stat-n` that `board.ts` live-ticks). → scorecard exists; M6 makes it clickable + per-lab (clickable scorecard is a **quick win, folded in here**).
- **`board.ts`** = the filter/sort/tick island over `.card` elements with `data-lab/-status/-committed/-deadline`. → reuse the pattern for the table.
- **`commitments.json.ts`** = a `prerender` JSON endpoint. → clone for CSV.
- **Gaps:** no `lastChecked`/last-verified field; no data license / "how to cite"; no CSV; no corrections data type.

## Data-model changes (minimal, all backward-compatible / optional)

1. `Commitment.lastChecked?: string` (`'YYYY-MM-DD'`) — when this row's status was last individually re-verified. Optional; absent → falls back to the global "dataset reviewed as of" date.
2. `Update.kind?: 'update' | 'correction'` (default `'update'`) — lets the corrections page filter ruling changes / fixes.
3. **Reuse `notes`** for provenance (no change). Optionally also `Commitment.sources?: {url,label}[]` for multiple sources — **deferred** (single `evidenceUrl` is fine for now).

No existing field changes → existing data-integrity tests stay green.

## Components & pages

### A. Per-lab pages — `src/pages/labs/[lab].astro` (`getStaticPaths` over labs that have commitments)
- URL `/labs/<slug>` (slug = lowercased, spaces→`-`, e.g. `google-deepmind`).
- **Report-card header:** the lab name + a row of `summarize(labRows, now)` counts (reuse `SummaryStats`) + a derived **kept-rate** (`met / (met+missed+partial)` among *resolved* lab commitments) stated with its formula in plain text.
- That lab's commitments listed below (reuse `CommitmentCard`), sorted by urgency.
- A **"Follow this lab"** affordance is **deferred to a later milestone** (needs per-scope subscriptions); for now link to the site's RSS/subscribe.
- Linked from each `CommitmentCard` (the lab badge → the lab page) and a labs index on `/methodology` or the homepage.

### B. Per-commitment detail pages — `src/pages/c/[id].astro` (`getStaticPaths` over all 29)
- URL `/c/<id>`.
- **Status timeline rail** (pure static markup): `Committed (committedOn) → Due (deadline) → Evaluated (resolvedOn) → Ruling (resolution)`. Past stages filled with the date; future/NA stages ghosted with an em-dash. For `trigger` deadlines, show `triggerText` instead of a Due date.
- The full commitment text, status chip, live countdown, the **`notes` provenance** ("Why this ruling"), `contested` flag, **Source** (`evidenceUrl` + `sourceLabel`), `committedOn`, `lastChecked`/global-as-of.
- Any `UPDATES` whose `commitmentIds` include this id, newest-first (the update log; thin today, grows via the watcher).
- A **"Cite this commitment"** snippet + a permalink.
- `CommitmentCard`'s title links to `/c/<id>`.

### C. Trust layer
- **Per-card + per-detail:** a small source line (`Source: <sourceLabel> ↗`) + **"as of <lastChecked || globalUpdated>"**.
- **`/methodology` additions:** a **"How to cite"** block with a pre-written string (author, "Overdue", year, canonical URL `https://overduetracker.org`, retrieved-on) and an explicit **data license** statement (see Decisions) with a "republish freely, attribution required" invite for journalists/researchers.
- **Data download:** keep `/commitments.json`; add **`/commitments.csv`** (`prerender` endpoint, flat columns) and a short **`/data` page** (or a README section) documenting columns, the status taxonomy, the license, and the "as of" date. A small "Download data (JSON · CSV)" link in the footer + on `/methodology`.

### D. Explore table view — `src/pages/table.astro` + `src/scripts/table.ts`
- A dense, **sortable + filterable** HTML table of all commitments: columns **Lab · Commitment · Category · Committed · Deadline · Status · Source**. Each row links to `/c/<id>`.
- Client island (mirrors `board.ts`): per-column header sort (click to sort asc/desc), a lab filter, a status filter, a text search, and a "reset". Live status/countdown consistent with the board via the shared `liveLabel`.
- Linked from the homepage ("View as table") and `/table` linked in nav. The card board stays the homepage default.

### E. Provenance — surface `notes`
- On `CommitmentCard`: a collapsible **"Why this ruling"** (`<details>`) showing `notes` when present. On `/c/<id>`: shown expanded. No data change.

### F. Corrections page — `src/pages/corrections.astro`
- Lists `UPDATES` with `kind === 'correction'` (ruling changes / data fixes), newest-first, each linking to the affected commitment(s). A short header: "When we change a ruling or fix an error, it's logged here." Empty-state copy until the first correction. This is the transparency move OWID/Net Zero do poorly — Overdue out-transparents its models.
- Linked from `/methodology` ("Corrections") and the footer.

## Decisions (recommendations — confirm at review)

1. **Data license = CC BY 4.0** for the dataset (code stays MIT). Rationale: an accountability tool *wants* redistribution but also wants attribution/credit; CC BY is the open-data standard (OWID uses it). Alternative: CC0 (public domain, no attribution) — rejected, we want credit. **Confirm.**
2. **Last-verified = per-row `lastChecked?` + a global "dataset reviewed as of <date>" fallback.** Honest for a small project (we review the whole set periodically; individual rows stamped when re-checked). Alternative: only the global date — simpler but less granular.
3. **Table = its own `/table` page** (not a toggle on the homepage). Keeps the homepage a clean card board; `/table` is the power view. 
4. **URLs:** `/labs/<slug>`, `/c/<id>`, `/table`, `/corrections`, `/commitments.csv`.

## Testing

Vitest, no DOM (consistent with the project):
- `labSlug(lab)` / un-slug round-trip; `keptRate(list)` math (resolved-only; 0-guard).
- `summarizeByLab` (or per-lab grouping) returns correct counts.
- CSV serialization: header + one row, fields with commas/quotes/newlines escaped (RFC 4180).
- `getStaticPaths` produce a path per commitment and per non-empty lab (assert counts).
- Data integrity (extend existing): `lastChecked` if present parses as a real UTC date; `Update.kind` ∈ {update,correction}.
- `npm run build` green; spot-check `/c/<id>`, `/labs/<slug>`, `/table`, `/commitments.csv`, `/corrections` render.

## File structure

**Create:** `src/pages/labs/[lab].astro` · `src/pages/c/[id].astro` · `src/pages/table.astro` · `src/scripts/table.ts` · `src/pages/corrections.astro` · `src/pages/commitments.csv.ts` · `src/lib/labs.ts` (slug + grouping + keptRate) · `src/lib/csv.ts` (pure serializer) · `LICENSE-DATA` (CC BY 4.0) · tests `tests/m6.test.ts`
**Modify:** `src/lib/types.ts` (+`lastChecked?`, +`Update.kind?`) · `src/components/CommitmentCard.astro` (title→/c/, lab→/labs/, "Why this ruling" details, "as of" line) · `src/pages/index.astro` (clickable scorecard, "View as table" + labs links) · `src/pages/methodology.astro` (How-to-cite, data license, Corrections + Download links) · footer (Download/Corrections) · `CHANGELOG.md` (M6 entry, same commit) · `README.md`

## Out of scope (deferred)
- Per-scope "follow this lab/commitment" email subscriptions (needs M5 subscription scoping) — later milestone.
- Quality/integrity badges (Specificity/Verifiability/Source-strength) — later; needs a scoring rubric.
- Multiple sources per commitment (`sources[]`).
- Cross-lab "report card / comparison" leaderboard page — candidate follow-up once per-lab pages exist.

## Risks / tradeoffs
- **Scope:** 6 features at once — mitigated because most reuse existing data + helpers (notes, summarize, board.ts, json endpoint). The genuinely new code is small (slug/keptRate/CSV + a few Astro pages).
- **`lastChecked` honesty:** if we stamp dates we didn't actually re-verify, it's misleading. Mitigation: only set `lastChecked` when a row is truly re-checked; otherwise the global "as of" date is the honest claim.
- **Static-path growth:** ~29 commitment pages + ~8 lab pages — trivial for Astro static build.
- **Kept-rate framing:** a single % can be cited unfairly. Mitigation: always show it *with* the underlying counts + the formula (CAT/GovTrack pattern: a number always carries its context).
