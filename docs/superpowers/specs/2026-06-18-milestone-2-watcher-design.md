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
.github/workflows/watch.yml   (on: workflow_dispatch + schedule cron '17 9 * * 1' [Mon 09:17 UTC];
                               permissions {contents:write, issues:write}; concurrency: watcher-state-main;
                               timeout-minutes: 10)
  → npm ci → npm exec tsx scripts/watch.ts
        scripts/watch.ts          # thin runner: I/O orchestration (fetch, GitHub API, read/write state)
        src/watcher/core.ts       # PURE: extractText, hashText, diffSummary, dueDeadlines, issueMarker
        .watcher/watchlist.json   # curated source pages to watch
        .watcher/state.json       # { id: { hash, lastChanged } } — committed back by the Action
        .watcher/snapshots/<id>.txt # prior extracted text per source (enables diffs) — committed back
  tests/watch.test.ts             # vitest over src/watcher/core.ts
```

- **TS throughout**, run in CI via **`tsx`** so the runner imports the typed dataset (`src/data/commitments.ts`) and the pure core directly. New **`devDependencies`**: `tsx` (`^4`, invoked as `npm exec tsx` — no run-time download of an undeclared tool) and **`cheerio`** (`^1`) for `extractText` (Node has no built-in HTML parser). Pure logic in `src/watcher/core.ts` is unit-tested; the fetch + GitHub REST calls are thin in `scripts/watch.ts`.

## 4. Source-change watch

- **Watchlist** (`.watcher/watchlist.json`): ~8–12 curated canonical pages — e.g. Anthropic `/rsp-updates`, OpenAI Preparedness Framework, Google DeepMind Frontier Safety Framework, Microsoft Frontier Governance, the EU AI Act implementation timeline. Each entry: `{ id, label, url }`, with an optional `stripSelectors` for per-source noise.
- **Server-rendered only (Codex #4):** watchlist entries MUST be server-rendered HTML, RSS/Atom, a JSON API, or a raw source document. **SPA / dashboard / tracker pages are excluded** — a plain `fetch` returns a JS app shell, so real changes are never detected. Notably the **Midas Project / `seoul-tracker.org` tracker is out for v1** unless a stable RSS/API/raw-data endpoint is found.
- **Flow per source:** `fetch(url)` → `extractText(html)` (cheerio: strip `script/style/head/noscript`, take body text, collapse whitespace) → `hashText` (SHA-256). Compare to `state[id].hash`; the prior text is read from the committed snapshot `.watcher/snapshots/<id>.txt`.
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
- **The `watcher` label must exist first (Codex #6):** creating an issue with a nonexistent label returns REST `422`. The runner ensures the `watcher` label exists via the labels API before any issue create (treat "already exists" as success; fail clearly on `403`).
- **Paginate** the open-issues lookup (`per_page=100`, follow `Link` headers) before concluding a marker is absent.

## 7. State storage

- `.watcher/state.json` (hashes + lastChanged) **and** per-source snapshots `.watcher/snapshots/<id>.txt` (normalized extracted text only, **≤100 KB each**, one current snapshot per source, no history) are committed back to `main` by the Action.
- **No deploy loop (Codex #1 — corrected):** commits pushed with the default `GITHUB_TOKEN` do **not** re-trigger `push` workflows, so the watcher cannot start a deploy run. `[skip ci]` is optional belt-and-suspenders, not the control. Still add `paths-ignore: ['.watcher/**', 'docs/**', '**.md']` to `deploy.yml`'s `push` trigger as defense against *human/PAT* commits touching those paths.
- **Race safety (Codex #2):** `watch.yml` sets `concurrency: { group: watcher-state-main, cancel-in-progress: false }`; before pushing state, `git pull --rebase origin main` and retry the push once on non-fast-forward.

## 8. Noise mitigation

- `extractText` (cheerio) strips `script/style/head/noscript` and collapses whitespace — this removes *script-embedded* noise (nonces, build hashes), but **visible** dynamic text (a "last updated" line, server-rendered counters, A/B content) survives and can flip a hash. Mitigations: optional per-source `stripSelectors` in `watchlist.json`, and a **minimum meaningful-diff threshold** (skip opening an issue for changes under ~3 changed lines).
- **Fetch contract (Codex #8):** every fetch uses `AbortSignal.timeout(15000)`, ≤1 retry with backoff on network/5xx, a 2 MB response cap, ≤5 redirects, and `timeout-minutes: 10` on the job. Never log `GITHUB_TOKEN` or request headers.
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

- Declare `permissions: { contents: write, issues: write }` on **`watch.yml` only** (built-in `GITHUB_TOKEN`; no external secrets). **Do not** broaden `deploy.yml` — it stays `contents: read, pages: write, id-token: write` (Codex #3).

## 11. Success criteria

- `npm test` passes including the new `watch.test.ts`.
- **Runner contract (Codex #11):** `npm exec tsx scripts/watch.ts --dry-run` (or `WATCHER_DRY_RUN=1`) fetches/reads/diffs and prints intended issue creates/updates + state writes **without** GitHub API calls or commits. A missing `GITHUB_TOKEN` defaults to dry-run; a `--ci` flag makes a missing token fail loudly. `now` (for `dueDeadlines`) is injectable for testing. Runs locally and in CI.
- A manual `workflow_dispatch` run: opens a `Deadline check:` issue for a genuinely-due unresolved commitment, and (after seeding a changed hash) a `Source changed:` issue — both deduped on re-run.
- The watcher's state commit does **not** trigger a site redeploy (paths-ignore verified).
- The watcher never modifies `src/data/commitments.ts`.
