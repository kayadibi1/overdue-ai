# Overdue — Milestone 2: The Watcher — Design Spec

- **Date:** 2026-06-18
- **Status:** Approved design (pending final spec review before implementation plan)
- **Project:** Overdue (https://github.com/kayadibi1/overdue-ai). Follows M1 (`2026-06-18-milestone-1-coverage-design.md`).

## 0. Where this sits

Roadmap: ✅ **M1 (credible reference)** → **M2 (this spec — freshness)** → M3 (RSS + email + launch). M2 makes "maintained" real: a scheduled job that surfaces *what to look at*, while the human stays the accuracy gate. It **never edits the dataset** — it only opens review issues.

## 1. Goal

A scheduled **GitHub Action** (weekly + manual `workflow_dispatch`) that runs two checks and opens deduplicated **review issues**:

1. **Source-change watch** — detect when a curated source page changes.
2. **Deadline reminders** — flag unresolved commitments whose deadline is near or just passed.

## 2. Scope

**In (v1):** the two checks; a curated watchlist; fetch + text-extract + hash + diff; GitHub-issue creation with dedupe; a committed state file; unit tests for the pure logic; the workflow.
**Out (deliberately):** LLM extraction of candidate commitments (mechanism C — deferred to a later milestone); any auto-editing of the dataset; email/Slack notifications (issues suffice); watching the per-row `evidenceUrl`s (those are static news articles).

## 3. Architecture

```
.github/workflows/watch.yml   (cron weekly + manual; permissions: contents:write, issues:write)
  → npm ci → npx tsx scripts/watch.ts
        scripts/watch.ts          # thin runner: I/O orchestration (fetch, GitHub API, read/write state)
        src/watcher/core.ts       # PURE: extractText, hashText, diffSummary, dueDeadlines, issueMarker
        .watcher/watchlist.json   # curated source pages to watch
        .watcher/state.json       # { id: { hash, lastChanged } } — committed back by the Action
        .watcher/snapshots/<id>.txt # prior extracted text per source (enables diffs) — committed back
  tests/watch.test.ts             # vitest over src/watcher/core.ts
```

- **TS throughout**, run in CI via **`tsx`** (small dev dep) so the runner can import the typed dataset (`src/data/commitments.ts`) and the pure core directly. Pure logic in `src/watcher/core.ts` is unit-tested; the fetch + GitHub REST calls are kept thin in `scripts/watch.ts`.

## 4. Source-change watch

- **Watchlist** (`.watcher/watchlist.json`): ~8–12 curated canonical pages where changes/new commitments actually appear — e.g. Anthropic `/rsp-updates`, OpenAI Preparedness Framework, Google DeepMind Frontier Safety Framework, Microsoft Frontier Governance, the Midas Project tracker, the EU AI Act implementation timeline. Each entry: `{ id, label, url }`.
- **Flow per source:** `fetch(url)` → `extractText(html)` (strip `<script>/<style>/<head>`, visible text, collapse whitespace) → `hashText` (SHA-256). Compare to `state[id].hash`; the prior text is read from the committed snapshot `.watcher/snapshots/<id>.txt`.
  - **First run (no prior hash):** write the snapshot + hash, open **no** issue (establish a baseline).
  - **Unchanged:** do nothing.
  - **Changed:** compute `diffSummary(prevText, newText)` (first ~20 added/changed lines); open/update one issue `Source changed: <label>` with marker `<!-- watcher:src:<id> -->` (body = URL, date, diff snippet). Then overwrite the snapshot and set `state[id] = { hash, lastChanged: today }`.
  - **Fetch error (non-200/timeout):** skip this source; leave its state + snapshot untouched; log only (no issue). One flaky fetch must not wipe a baseline.

## 5. Deadline reminders

- Read `COMMITMENTS` from `src/data/commitments.ts`. `dueDeadlines(commitments, now)` returns **unresolved** (`resolution === null`) `track: 'lab'` rows with a calendar `deadline` that is within the next 30 days **or** passed within the last 14 days.
- For each, open/update one issue titled `Deadline check: <title>` with marker `<!-- watcher:deadline:<id> -->`, body = the commitment, its deadline, computed status, and a prompt to verify and set `resolution`.
- Regulatory rows are excluded (they're not scored).

## 6. Issue dedupe

- Before creating, list open issues with label `watcher` (GitHub REST: `GET /issues?labels=watcher&state=open`).
- Match by the stable HTML-comment **marker** in the body (`watcher:src:<id>` / `watcher:deadline:<id>`).
- If an open issue with that marker exists → **update** it (refresh body/diff) rather than open a duplicate. Otherwise **create** it with the `watcher` label.
- Dedupe is against **open** issues only. Closing an issue signals "handled"; because the state/snapshot is updated when the change is first reported, a closed issue will not reappear unless the source changes *again* (a new hash), at which point a fresh issue is opened.

## 7. State storage

- `.watcher/state.json` (hashes + lastChanged) **and** the per-source snapshots `.watcher/snapshots/<id>.txt` are committed back to `main` by the Action (`git commit` with `[skip ci]` in the message **and** `paths-ignore` on the deploy workflow).
- **Deploy workflow change:** add `paths-ignore: ['.watcher/**', 'docs/**', '**.md']` to `.github/workflows/deploy.yml`'s `push` trigger so the watcher's state commits (and doc edits) don't trigger a site rebuild/deploy loop.

## 8. Noise mitigation

- `extractText` strips scripts/styles/`<head>`, takes text content, collapses whitespace — removing most dynamic noise (timestamps in scripts, nonces).
- Dedupe (one open issue per source) prevents spam.
- Weekly cadence + human-in-loop. If a page proves too noisy, drop it from `watchlist.json` (data change, no code change).

## 9. Testing (vitest, pure core only)

- `extractText` — strips scripts/styles; returns stable text for the same meaningful content despite differing whitespace.
- `hashText` — deterministic; different text → different hash.
- `diffSummary` — surfaces added/changed lines; empty when identical.
- `dueDeadlines` — includes unresolved lab rows within +30d / -14d; excludes resolved, regulatory, far-future, and old-past rows.
- `issueMarker` — stable, unique per id/kind.
The fetch + GitHub-API layer in `scripts/watch.ts` is thin and exercised by a manual `workflow_dispatch` run, not unit-tested.

## 10. Permissions & secrets

- The workflow uses the built-in `GITHUB_TOKEN` with `permissions: { contents: write, issues: write }`. No external secrets.

## 11. Success criteria

- `npm test` passes including the new `watch.test.ts`.
- `npx tsx scripts/watch.ts` runs locally (dry-run mode prints intended issues without calling the API) and in CI.
- A manual `workflow_dispatch` run: opens a `Deadline check:` issue for a genuinely-due unresolved commitment, and (after seeding a changed hash) a `Source changed:` issue — both deduped on re-run.
- The watcher's state commit does **not** trigger a site redeploy (paths-ignore verified).
- The watcher never modifies `src/data/commitments.ts`.
