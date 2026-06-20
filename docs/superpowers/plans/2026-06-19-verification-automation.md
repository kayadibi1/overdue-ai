# Verification & Methodology Automation — Implementation Plan (v3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Make every Overdue ruling auditable, archived, multi-sourced, quote-pinned, and freshness-tracked — automating detection/bookkeeping while keeping the met/missed/partial verdict human.

**Architecture:** Hand-authored facts stay in `src/data/commitments.ts` (now multi-source + quotes). The existing watcher (`scripts/watch.ts` + `src/watcher/core.ts` + `.watcher/`) is **extended** with new checks (source-health/quote-drift, staleness, Wayback archival, Class-A fulfillment). A new `src/data/verification.json` holds on-site badge state, written by the cron behind a **validation gate** and read by a **defensive loader**. Class-B LLM adjudication runs headless `claude -p` on the maintainer's subscription. Verdicts stay human; the bot never writes `commitments.ts`.

**Tech Stack:** Astro 5 + TS, Vitest (node), Node 22, `tsx`, cheerio (dep), GitHub Actions, headless Claude Code `@anthropic-ai/claude-code@2.1.183`.

**Spec:** `docs/superpowers/specs/2026-06-19-verification-automation-design.md`.

---

## What changed from v2 (second adversarial-review fixes)

- **C1 — pre-merge workflow validation was impossible** (`workflow_dispatch` needs the workflow on the *default* branch). v3 validates offline pre-merge and runs the first live dispatch **after** merge, with a smoke-test-and-revert step (Task 14 + Merge gate).
- **C2 — watcher reuse was mechanically false.** `fetchText` is private to `watch.ts`; `issueMarker` kind is `'src'|'deadline'`. v3 adds `src/watcher/core.ts` to the change set: export a shared `fetchHtml`, widen the `issueMarker` kind union, update `tests/watch.test.ts` (Task 9).
- **C3 — no validation gate on the build-critical `verification.json`.** v3 adds a defensive loader (missing/invalid → no badges, never throws) and a pre-commit schema guard (refuse to commit a malformed file) (Tasks 6, 10).
- **H1** data.test.ts M6 block re-pointed; **H2** Wayback rewritten to the async job-poll flow; **H3** trigger→overdue rows enumerated + the public-count change surfaced; **M1** version pinned; **M2** CSV contract fixed (3 slots); **M3** commit identities split (human vs bot); **M4** existing `lastChecked` carried into `reviewedOn`.

---

## File Structure

**New:** `src/data/verification.json`, `src/lib/verification.ts` (defensive loader), `src/lib/sources.ts` (`primarySource`), `src/lib/verify/{classify,staleness,invariants,fulfillment,schema}.ts`, `src/watcher/checks.ts`, `scripts/lib/{wayback,claude}.mjs`, `scripts/adjudicate.mjs`, `.github/workflows/verify-sources.yml`. Tests: `tests/verify-{classify,staleness,invariants,fulfillment,loader}.test.ts`, `tests/status-trigger.test.ts`.

**Modified:** `src/lib/types.ts`, `src/data/commitments.ts`, `src/lib/status.ts`, `src/lib/csv.ts`, `src/lib/site.ts`, **`src/watcher/core.ts`**, `src/components/{CommitmentCard,RegulatoryItem}.astro`, `src/pages/c/[id].astro`, `src/pages/table.astro`, `src/pages/methodology.astro`, `scripts/watch.ts`, `.watcher/watchlist.json`, `tests/{data,status,m6,watch}.test.ts`, `package.json`, `CHANGELOG.md`.

---

# PHASE 0 — Branch

### Task 0
- [ ] `git checkout main && git pull && git checkout -b feat/verification`. Confirm `npx vitest run` (52 pass) + `npm run build` green — the bar every merge must clear.

---

# PHASE 1 — Schema, helper & full-consumer migration

### Task 1: Types (`Source`, `FulfillmentCheck`, extended `Commitment`)
As v2 Task 1 (spec §3.1/§3.2): remove `evidenceUrl`/`sourceLabel`/`lastChecked`; add `sources[]`, `deadlineBasis?`, `derivationNote?`, `triggerFired?`, `triggerFiredOn?`, `reviewedBy?`, `reviewedOn?`, `fulfillmentCheck?`. TDD via `tests/verify-invariants.test.ts`. Commit. (Repo typecheck now red until Task 3 — fine on a branch.)

### Task 2: `primarySource` helper + invariants
As v2 Task 2. `src/lib/sources.ts` (`primarySource` → obligation source ?? `sources[0]`) + `src/lib/verify/invariants.ts` (`checkInvariants`: obligation-quote, missed-signoff, missed-sourcing, derived-note). TDD. Commit.

### Task 3: Migrate all 35 rows + EVERY consumer + tests (atomic — ends green)
**Files:** `src/data/commitments.ts`, `CommitmentCard.astro`, `RegulatoryItem.astro`, `c/[id].astro`, `table.astro`, `csv.ts`, `site.ts`, `scripts/watch.ts`, `tests/{data,status,m6,watch}.test.ts`

Display/consumer edits (grep-verified line numbers):
- `RegulatoryItem:13`, `CommitmentCard:77`, `table:82`, `c/[id]:82` — `c.evidenceUrl`/`c.sourceLabel` → `primarySource(c).url`/`.label`.
- `CommitmentCard:32`, `c/[id]:32` — `c.lastChecked ?? DATA_AS_OF` → `c.reviewedOn ?? DATA_AS_OF`.
- `site.ts:2` — comment `lastChecked` → `reviewedOn`.
- `scripts/watch.ts:86` — `${d.c.evidenceUrl}` → `${primarySource(d.c).url}` (import helper).
- `csv.ts` — see M2 contract below (a **`toCsv` rewrite**, not just a `COLS` swap).
- `tests/data.test.ts:26-29` — assert `primarySource(c).url` is a URL, `.label` truthy. **`tests/data.test.ts:70-77` (M6 block)** — re-point `'every lastChecked … is a real UTC date'` to `reviewedOn`; add the dataset-wide `checkInvariants` + "no row has `evidenceUrl`" assertions here.
- `tests/status.test.ts:11`, `tests/m6.test.ts:9`, `tests/watch.test.ts:11` — fixtures `evidenceUrl/sourceLabel` → `sources:[{url,label,tier:'primary',role:'obligation',quote:'q'}]`.

**M4 — carry existing dates:** the 6 rows that currently have `lastChecked:'2026-06-19'` (commitments.ts lines 333/344/355/366/377/388) must set `reviewedOn:'2026-06-19'` (do not drop). Note: the visible "as of" text changes only on rows that get a `reviewedOn` distinct from `DATA_AS_OF`.

**M2 — CSV contract:** fixed **3 source slots**: `source_1_url,source_1_label,source_1_role,source_2_url,...,source_3_role,archive_url,reviewedOn`. Rows with >3 sources omit extras (the column comment + methodology note: "additional sources in the JSON export"). `toCsv` needs **custom per-source extraction** — the current generic `(c as Record)[k]` accessor (csv.ts) cannot reach `sources[i].url`.

**H3 — fired triggers (product change, surfaced):** during migration set `triggerFired:true` + `triggerFiredOn` on trigger rows whose condition has **factually occurred** — at minimum `anthropic-asl4-before-asl3` (ASL-3 activated 2025-05-22 per its own notes). **This moves those rows from hidden `pending` to visible `overdue`, increasing the front-page "Overdue right now" count.** That is the intended fix for gap #7, but it is a public-facing change — call it out in the PR/changelog. Leave `triggerFired` unset where the condition has not occurred.

- [ ] **Step 1:** Add the dataset invariant + no-`evidenceUrl` tests (in data.test.ts). Run → FAIL.
- [ ] **Step 2:** Migrate the 35 rows (lab + regulatory) to `sources[]`; backfill verbatim `quote` on every obligation source; set `reviewedOn`/`reviewedBy`; `deadlineBasis:'derived'`+`derivationNote` on derived rows; `triggerFired` per H3; `fulfillmentCheck` on publish-by-date rows. **Order: 16 contested rows first.** Unconfirmable quote → best text + `// TODO verify quote`.
- [ ] **Step 3:** Update all consumer + test files above (incl. the `toCsv` rewrite + the M6 block).
- [ ] **Step 4:** **Full** `npx vitest run` green + `npm run build` green. Do not commit until both pass.
- [ ] **Step 5:** Commit (one atomic schema-cutover commit; author `kayadibi1 <sidarvig@gmail.com>`).

---

# PHASE 2 — Status logic & rubric

### Task 4: Fired-trigger status
`src/lib/status.ts` — `deadlineType:'trigger'` → `triggerFired ? 'overdue' : 'pending'`. TDD `tests/status-trigger.test.ts` (unfired→pending, fired→overdue, resolved keeps resolution). Note for Task 7: `relativeTime` returns `null` for a deadline-less trigger, so a fired trigger renders its `triggerText` phrase with overdue card styling — confirm visually in Task 7. Run full suite. Commit.

### Task 5: Methodology rubric + verification description
`src/pages/methodology.astro` — Met/Missed/Partial/Contested rubric (spec §4) + reader-facing "How we keep it current". Build. Commit.

---

# PHASE 3 — Badge state & on-site surfacing

### Task 6: `verification.json` + **defensive** loader + staleness
**Files:** `src/data/verification.json`, `src/lib/verification.ts`, `src/lib/verify/{staleness,schema}.ts`; Tests `tests/verify-staleness.test.ts`, `tests/verify-loader.test.ts`

- [ ] **Step 1:** Failing staleness tests (30/180) **and** loader-tolerance tests: a missing file, `{rows:{}}`, and a malformed blob each yield "no badges" and **never throw**.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `staleness.ts` (`isStale`, `STALE_DAYS={volatile:30,settled:180}`). `verify/schema.ts` — a `parseVerification(raw): VerificationState` guard returning `{rows:{}}` on any shape violation. `verification.json` seed = `{ "rows": {} }` (**no run timestamp** — that's what keeps quiet days from redeploying).
- [ ] **Step 4 (C3):** `verification.ts` reads the file via `readFileSync(path,'utf8')` + `JSON.parse` **inside a try/catch** (NOT a static `import data from '../data/verification.json'` — Vite parses a static JSON import at transform time, *before* any try/catch, so malformed JSON would still break the build). On any parse/shape error → `parseVerification` returns `{rows:{}}` and the loader falls back to empty, so a bad commit can never break the build. Expose `isUnderReview`, `archiveFor`, `lastChangedOn`. (Mirror the existing `.watcher` read pattern at `watch.ts:24-25`.)
- [ ] **Step 5:** Run + build PASS. Commit.

### Task 7: On-site citations, badges, derived + fired-trigger render
`CommitmentCard.astro`, `c/[id].astro`, `global.css` — render all `c.sources` by role (obligation exposes `quote` in `<details>`; archive link via `archiveFor`); static "sources auto-checked daily" line; `⚠ under review` pill when `isUnderReview`; `†` derived marker. **Screenshot check must include (a) a multi-source row, (b) a derived-deadline row, and (c) a fired-trigger (`overdue`, deadline-less) row** to confirm H3 renders coherently. Build + preview + screenshot. Commit.

### Task 8: Clean-break CSV
`src/lib/csv.ts` already rewritten in Task 3. Here: add/confirm `tests/data.test.ts` (or `tests/exports.test.ts`) asserting the CSV header has `source_1_url`/`archive_url` and no `evidenceUrl`; `commitments.json.ts` is a raw dump (no change). Run, build, commit.

---

# PHASE 4 — Extend the watcher (the engine)

### Task 9: Hoist shared fetch + widen markers (C2) + drift classify + checks module
**Files:** `src/watcher/core.ts`, `scripts/watch.ts`, `src/lib/verify/classify.ts`, `src/watcher/checks.ts`; Tests `tests/verify-classify.test.ts`, `tests/watch.test.ts`

- [ ] **Step 1 (C2):** Move `fetchText` from `scripts/watch.ts` into `src/watcher/core.ts` exported as `fetchHtml(url)` (it imports only crypto/cheerio/status today, so a `fetch` helper is leaf-safe); update `watch.ts` to import it. Widen `issueMarker`'s kind to `'src'|'deadline'|'source'|'stale'|'fulfillment'` and update `tests/watch.test.ts:69-73` (which locks the marker contract) for the new kinds.
- [ ] **Step 2:** Failing tests for `normalize` + `classifyQuote(text,quote,prevOk)` (ok/inconclusive/drifted). Run → FAIL.
- [ ] **Step 3:** Implement `classify.ts`. Implement `src/watcher/checks.ts` with pure (fetch-injected) functions returning `{planned, rowStates}`:
  - `checkSourceHealth` — per `c.sources`: `fetchHtml`→`extractText`→`classifyQuote` vs stored `prevOk`; dead link / `drifted` → `Planned` (`issueMarker('source', c.id)`) + row problem.
  - `checkStaleness` — `isStale` → row problem.
  - `checkInvariants` over the dataset → row problems.
- [ ] **Step 4:** Run all PASS (incl. updated watch.test). Commit.

### Task 10: Wire checks into `scripts/watch.ts` + **guarded** verification.json write
**Files:** `scripts/watch.ts`

- [ ] In `main()`, after `checkSources()`/`checkDeadlines()`, run the `checks.ts` functions (sharing `planned[]` + the existing upsert). Assemble `verification.json` state.
- [ ] **C3 + L1 — guarded write:** build the new object, run it through `parseVerification` (Task 6 schema) — if it doesn't validate, **do not write**, leave the prior file, and add a `Planned` issue ("verification.json failed validation"). Otherwise write `src/data/verification.json` **only if it differs from the on-disk file** (exact predicate: `JSON.stringify(next) !== JSON.stringify(prev)`; legitimate `archiveUrl`/`quoteCheck` changes *will* commit+redeploy — that is intended, not a quiet day).
- [ ] Extend `tests/watch.test.ts` (dry-run path + the validation-refusal path). Run, commit.

### Task 11: Wayback archival (async job-poll — H2)
**Files:** `scripts/lib/wayback.mjs`

- [ ] `archive(url)`: **POST** `https://web.archive.org/save` with `Accept: application/json` (+ `Authorization: LOW <IA_ACCESS_KEY>:<IA_SECRET_KEY>` when set) → read `job_id` → **poll** `GET https://web.archive.org/save/status/<job_id>` until `status==='success'` (cap ~60s) → build `https://web.archive.org/web/<timestamp>/<original_url>`. On any failure/timeout/429 → query `https://archive.org/wayback/available?url=<url>` → return `closest.url` if present, else `null` (soft "unarchived" note — no silent cap; log it).
- [ ] **Incremental + polite:** only obligation sources lacking `archiveUrl` or >180d old; ~5s between calls; cap 10/run, carry remainder to next daily run (logged). Store `archiveUrl` in `verification.json`; fill CSV `archive_url`.
- [ ] Run `--only=<id>` locally (verify a real snapshot URL comes back). Commit.

### Task 12: Class-A fulfillment proposals
As v2 Task 12. `src/lib/verify/fulfillment.ts` (`proposeFulfillment`) + wire into `checks.ts` (evaluate `fulfillmentCheck` → proposal in `verification.json` + `Planned` issue; **never sets `resolution`**). TDD. Commit.

---

# PHASE 5 — LLM adjudication & the workflow

### Task 13: Class-B adjudication (`adjudicate.mjs`, hardened)
**Files:** `scripts/lib/claude.mjs`, `scripts/adjudicate.mjs`; Test `tests/adjudicate.test.ts` (pure prompt/parse only)

- [ ] **Step 1:** Failing tests for `buildPrompt(c, artifactText)` and `parseVerdict(stdout)`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `claude.mjs` — `runClaude(prompt)`: spawn `claude -p <prompt> --output-format json --dangerously-skip-permissions`, `AbortSignal.timeout(120_000)`; child env **with both `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` deleted** (both outrank the OAuth token in precedence) and `CLAUDE_CODE_OAUTH_TOKEN` passed. Non-zero / `authentication_failed` / 401 / timeout → `{ok:false}`. `adjudicate.mjs` — for rows with a new artifact, `runClaude`; `{ok:false}` → tag "needs manual adjudication" + `exit 0`; success → write proposal (status+rationale+citation+'class-B') to `verification.json` (through the same Task-10 validation gate). **Never sets `resolution`.**
- [ ] **Step 4:** Pure tests PASS. Commit.

### Task 14: The workflow + **post-merge** live validation (C1, M3, L2)
**Files:** `.github/workflows/verify-sources.yml`

- [ ] **Step 1:** Author it modeled on `watch.yml`:
  - Triggers: `schedule` daily `'0 7 * * *'` + hot-row `'0 */6 * * *'` + `workflow_dispatch`. **No `push:`** (no self-retrigger).
  - `permissions:{contents:write, issues:write}`; `concurrency: verify-sources`.
  - Steps: checkout → node 22 → `npm ci` → `npm run build` *(throwaway — reads the **old** verification.json; only the commit-back's downstream `deploy.yml`/`deploy-newbox.yml` publish — **L2** one-line comment)* → run the verify entry → adjudication step (install `@anthropic-ai/claude-code@2.1.183`; env `CLAUDE_CODE_OAUTH_TOKEN`; script strips the two API-key vars; `|| echo skipped`).
  - **Commit-back, two targets, both as the bot identity `overdue-watcher <actions@github.com>` (M3):**
    - `.watcher/**` → `chore(watcher): state [skip ci]` + rebase + push (copy `watch.yml`).
    - `src/data/verification.json` → `chore(verify): refresh badges` **without `[skip ci]`**, *only if changed* (deliberately redeploys to refresh badges).
- [ ] **Step 2 (C1 — validation is POST-merge):** Pre-merge, validate **offline**: `npx vitest run`, `npm run build` (apex) + `PAGES=1 npm run build`, and `npm run watch -- --dry-run` (no token → dry run, exercises the check logic without API writes). The first **live** `workflow_dispatch` can only happen **after** the workflow is on `main` (GitHub won't dispatch a non-default-branch workflow). So: merge (gate below), then immediately `gh workflow run verify-sources.yml`, watch one run end-to-end (subscription auth, commit-back guards, no self-retrigger, issue upsert). **Smoke-test-and-revert:** if it misbehaves, the only artifact it can have changed is `verification.json` (revertable in one commit) — the data file and code are untouched by the bot.
- [ ] **Step 3:** Commit.

### Task 15: Methodology/README + CHANGELOG
As v2 Task 15. Document the `sources[]`/archive export shape + daily verification + **the fired-trigger overdue-count change (H3)** in the CHANGELOG. Build + full suite green. Commit.

---

## Merge gate (C1-aware)
- [ ] On `feat/verification`: full `npx vitest run` green; `npm run build` + `PAGES=1 npm run build` green; `npm run watch -- --dry-run` clean.
- [ ] Merge `--no-ff` to `main` (author `kayadibi1 <sidarvig@gmail.com>`). This is the first push to hit `deploy.yml`'s `npm test` — the gate guarantees green.
- [ ] **Post-merge:** `gh workflow run verify-sources.yml`, observe one successful live run (the only validation of subscription auth + commit-back that GitHub allows). Keep the revert-`verification.json` path ready.

## Self-Review
- v1 + v2 findings: all resolved or explicitly handled (C1 post-merge validation, C2 `core.ts` changes listed, C3 defensive loader + pre-commit gate, H1 M6 block, H2 job-poll, H3 enumerated + surfaced, M1 pinned 2.1.183, M2 CSV contract + `toCsv` rewrite, M3 split identities, M4 carry dates, L1 diff predicate, L2 throwaway-build note, L3 strip both key vars). ✓
- Consumer completeness incl. `RegulatoryItem`, `table`, `site.ts`, `watch.ts`, the M6 test block, and `src/watcher/core.ts`. ✓
- Green-main via branch + gate; no deploy loop / self-retrigger; bad `verification.json` can't break the build (loader degrades) and can't be committed (pre-commit gate). ✓
- Human-verdict invariant: no task writes `resolution`. ✓

## Repo policy
Implementation/task commits: author `kayadibi1 <sidarvig@gmail.com>`. Cron runtime commit-backs: `overdue-watcher <actions@github.com>`. Explicit `git add` paths only (never `-A`). All dev on `feat/verification`; merge only at the gate.
