# Verification & Methodology Hardening — Design Spec

**Date:** 2026-06-19
**Status:** Design (awaiting review) → then implementation plan
**Goal:** Make every Overdue ruling *auditable, archived, multi-sourced, and freshness-tracked*, with the bookkeeping fully **automated** — so the dataset's credibility holds up sustainably without manual chore-work, while the irreducibly human part (the met/missed/partial verdict) stays human.

---

## 0. The locked decisions

| Fork | Choice | Why |
|---|---|---|
| Source archiving | **Wayback Save-Page-Now** (free IA API; store snapshot URL) | Zero-maintenance, free, neutral third party |
| Drift detection | **Stored verbatim quote → CI substring match** (normalized) | Deterministic, free, runs every build; forces us to store the real quote |
| On a failed check | **Upsert one rolling GitHub issue + on-site "under review" badge** | Trackable for the maintainer, honest to readers, never blocks deploys |

## 1. The core principle: automate detection, not judgment

Automation **owns**: link-health, quote-drift, archival, staleness clocks, surfacing elapsed triggers, and enforcing that reputational rulings were reviewed.

A **human still owns**: the met / missed / partial verdict. Automation can prove "the source still says X" and "this row hasn't been looked at in 90 days" — it cannot decide whether a promise was *kept*. The system's job is to **route a human to the rows that need a verdict and guarantee the evidence behind every verdict is still standing.**

Two consequences that shape everything below:

- **The hand-authored data file is never written by a bot.** `src/data/commitments.ts` stays human-only (facts, quotes, verdicts). All machine-generated state (archive URLs, last-checked timestamps, link/quote health) lives in a **separate generated `verification.json`**. This keeps curation clean and avoids fragile programmatic edits to a TypeScript file.
- **Deploys never block on third-party health.** A lab deleting a page is *their* failure, not a reason our site can't ship. Problems surface as an issue + a visible "under review" badge, not a red build.

## 2. The 8 gaps and how this design closes each

| # | Gap (from the methodology review) | Closed by |
|---|---|---|
| 1 | One source per row (obligation vs fulfillment collapsed) | `sources: Source[]` with a `role` per source (§3) |
| 2 | Freshness half-built (`lastChecked` on ~6/35 rows; one global "updated" date) | Automated per-source `sourceCheckedOn` in `verification.json` + per-row ruling-age + on-site badges (§3, §7, §8) |
| 3 | No source archiving (link rot, silent edits) | Wayback snapshot per source, auto-captured (§6) |
| 4 | No verbatim commitment quote stored | `quote` required on `obligation` sources; powers the drift check (§3, §6) |
| 5 | Derived deadlines not structurally distinguished | `deadlineBasis: 'stated' \| 'derived'`; derived → rendered distinctly + auto-contested (§3, §5, §8) |
| 6 | "Partial" undefined | Written rating rubric on the methodology page + machine-checkable invariants (§4) |
| 7 | Fired triggers masquerade as "pending" | `triggerFired` flag → `computeStatus` returns `overdue`; cron flags long-pending triggers for review (§5, §6) |
| 8 | Solo curation, no sign-off on reputational rulings | `reviewedBy` + CI invariant: a `missed` ruling requires `reviewedBy` and ≥2 sources (or a primary admission) (§3, §9) |

## 3. Data-model changes

### 3.1 New `Source` type (replaces `evidenceUrl` + `sourceLabel`)

```ts
export type SourceTier = 'primary' | 'secondary';
//  primary   = the subject's own published document (lab blog/policy/PDF, govt text)
//  secondary = reporting or third-party analysis

export type SourceRole = 'obligation' | 'fulfillment' | 'context';
//  obligation  = the document that CREATES the promise (must carry a `quote`)
//  fulfillment = the document proving it was / was not delivered
//  context     = background, not load-bearing for the ruling

export interface Source {
  url: string;
  label: string;          // e.g. "Anthropic", "Fortune"
  tier: SourceTier;
  role: SourceRole;
  quote?: string;         // REQUIRED when role === 'obligation' — the verbatim committing sentence
}
```

### 3.2 `Commitment` extensions

```ts
export interface Commitment {
  // ... existing fields, MINUS evidenceUrl / sourceLabel ...
  sources: Source[];                       // gap #1, #4 — was a single url+label

  deadlineBasis?: 'stated' | 'derived';    // gap #5 — default 'stated'; 'derived' means WE inferred the date
  derivationNote?: string;                 // when derived, how we got the date (e.g. "v2 'at least once a year' cadence")

  triggerFired?: boolean;                  // gap #7 — human sets true when a trigger condition has occurred
  triggerFiredOn?: string | null;          // 'YYYY-MM-DD'

  reviewedBy?: string;                     // gap #8 — initials/handle of the human who last vetted the verdict
  reviewedOn?: string | null;              // 'YYYY-MM-DD' — last HUMAN review of the ruling (distinct from auto checks)
}
```

`lastChecked` is **removed** from the hand-authored type — its job (when the *source* was last confirmed) moves to the machine-managed `verification.json` as `sourceCheckedOn`. The human-review timestamp is the new `reviewedOn`.

### 3.3 Machine state: `verification.json` (generated, committed by the cron)

```jsonc
{
  "generatedOn": "2026-06-19",
  "rows": {
    "openai-preparedness-annual-review": {
      "sources": [
        {
          "url": "https://openai.com/index/updating-our-preparedness-framework/",
          "linkOk": true,                         // last HTTP status was 2xx
          "quoteCheck": "ok",                     // 'ok' | 'inconclusive' | 'drifted'
          "archiveUrl": "https://web.archive.org/web/2026.../...",
          "sourceCheckedOn": "2026-06-19"
        }
      ],
      "problems": []                              // human-readable problem strings; non-empty ⇒ "under review"
    }
  }
}
```

- `quoteCheck`: `ok` = the stored quote is present on the fetched page; `inconclusive` = link is 2xx but the quote wasn't found (likely JS-rendered/paywalled — a **soft** flag, no alarm on first occurrence); `drifted` = the quote was present before and is now absent (a **hard** flag — the page changed under us).
- The build reads this file; a row is **"under review"** iff its `problems[]` is non-empty.

## 4. The rating rubric (gap #6)

Added to `methodology.astro` and enforced as invariants where machine-checkable (§9):

- **Met** — the obligation's required artifact or action was delivered by the deadline (or the trigger was satisfied), evidenced by a **`fulfillment` source** (primary preferred).
- **Missed** — the deadline passed (or the trigger fired) with no qualifying delivery. Requires **especially strong sourcing**: a primary admission, or ≥2 independent sources. A "missed" resting only on *absence of evidence* is always **`contested`**.
- **Partial** — a multi-part obligation was *partly* delivered, **or** delivered substantially late, **or** delivered in a materially weakened form. The `notes` field **must enumerate** what was and wasn't met. (Previously undefined — this is the new bright line.)
- **Contested** (`contested: true`) — any ruling that rests on secondary reporting, a `derived` deadline, an argument-from-absence, or a genuine interpretive dispute. Phrased as an open question, never as a verdict.

## 5. Status-logic changes (`src/lib/status.ts`)

### 5.1 Fired triggers stop hiding (gap #7)

```ts
export function computeStatus(c: Commitment, now: number): Status {
  if (c.resolution) return c.resolution;
  if (c.deadlineType === 'calendar' && c.deadline) {
    return parseUTC(c.deadline) > now ? 'upcoming' : 'overdue';
  }
  if (c.deadlineType === 'trigger') {
    return c.triggerFired ? 'overdue' : 'pending';   // fired-but-unruled ⇒ demands attention, not benign 'pending'
  }
  return 'pending';
}
```

Today the Anthropic *ASL-4-before-ASL-3* row sits as `pending` even though its trigger (ASL-3 activation, 2025-05-22) has elapsed. After this change, setting `triggerFired: true` surfaces it as **overdue** until a human rules it. Automation can't *detect* firing (triggers aren't machine-readable), so the cron additionally flags **any `pending` trigger older than 180 days** into the report for human attention.

### 5.2 Derived deadlines (gap #5)

`deadlineBasis: 'derived'` rows: render the deadline with a visible "derived" marker (e.g. `2026-04-15†`) linking to `derivationNote`, and treat them as **auto-contested** (a derived date driving an "overdue" headline is our highest-risk claim type, so it must read as an open question).

## 6. The verification script — `scripts/verify-sources.mjs`

Pure Node (built-in `fetch`, no new runtime deps). Run by CI and locally (`npm run verify`). For every `Source` of every commitment:

1. **Link health** — `HEAD` then fallback `GET`; record `linkOk` (2xx/3xx). A 4xx/5xx is a **problem**.
2. **Quote drift** (obligation sources only) — fetch HTML, strip tags, normalize (collapse whitespace, straighten curly quotes, lowercase), and check `pageText.includes(normalize(quote))`.
   - present → `quoteCheck: 'ok'`.
   - absent + link 2xx + previously `ok` → `quoteCheck: 'drifted'` → **problem**.
   - absent + link 2xx + never confirmed → `quoteCheck: 'inconclusive'` → **soft note** (JS-rendered/paywall), not a problem until a human confirms the quote once.
3. **Archive** — if no `archiveUrl` yet (or it's >180 days old), call Wayback Save-Page-Now (SPN2 async flow: `POST https://web.archive.org/save` with the URL in the form body + `Accept: application/json` → read `job_id` → poll `GET /save/status/<job_id>` until `success` → build `/web/<timestamp>/<original_url>`), store the snapshot URL. On rate-limit/failure/timeout, fall back to the Availability API (`https://archive.org/wayback/available?url=`) for an existing snapshot; if none, leave a soft note (don't fail). Optional `IA_ACCESS_KEY`/`IA_SECRET_KEY` secrets enable authenticated SPN for higher rate limits.
4. **Staleness** — compute `now − reviewedOn` (human review age). Contested or unresolved rows older than **30 days**, others older than **180 days** → **problem** ("ruling needs re-review").
5. **Trigger age** — `pending` triggers with `triggerFired !== true` and `committedOn` older than 180 days → **soft note** ("confirm whether trigger has fired").
6. **Sign-off invariant** — any `resolution: 'missed'` with no `reviewedBy`, or with <2 sources and no primary `fulfillment` source → **problem** (§9).

**Output:** writes `src/data/verification.json` and prints a summary. Exit code is **always 0 by default** (deploys never block); a `--strict` flag (for manual runs) exits non-zero if any hard problem exists. Graceful degradation is mandatory — network flakiness must produce soft notes, not false alarms (retry each fetch up to 3× with backoff; a fetch that never resolves is `inconclusive`, not `drifted`).

## 7. The automation workflow — `.github/workflows/verify-sources.yml`

- **Triggers:** `schedule` **daily** (`cron: '0 7 * * *'`, full run) + an optional **6-hourly "hot-row" pass** (`cron: '0 */6 * * *'`) limited to rows with a deadline within ±7 days + `workflow_dispatch` (manual). Public repo ⇒ unlimited free Actions minutes, so cadence is not cost-constrained; the live overdue/upcoming timers are client-side and independent of the cron regardless.
  - **Deploy-churn guard:** the commit-back (and therefore the deploy) happens **only when `verification.json` actually changed** — a quiet run commits nothing. LLM/subscription cost is cadence-independent (fires only on a genuinely new artifact).
- **Permissions:** `contents: write`, `issues: write` — both covered by the default `GITHUB_TOKEN` (no PAT, no extra secret needed; the "bot token" is just the built-in token).
- **Steps:**
  1. Checkout, `npm ci`.
  2. `node scripts/verify-sources.mjs` → updates `verification.json`.
  3. **Commit-back** the changed `verification.json` (author `kayadibi1 <sidarvig@gmail.com>`) and push to `main`. This both records the fresh state and triggers the normal deploy, refreshing the on-site badges.
  4. **Upsert one rolling issue** titled `🔎 Source verification report` (found by the `verification-report` label): if there are problems, create-or-update its body with the current problem list grouped by row; if clean, update it to "✅ all sources healthy" and close it. One issue, never spam.

The weekly cadence + commit-back is the whole sustainability story: the freshness clock advances itself, archives refresh themselves, and the maintainer gets one tidy issue only when something actually needs a human.

## 8. On-site surfacing (`CommitmentCard.astro`, `c/[id].astro`, `methodology.astro`)

- **Multi-source citations** — render all `sources[]` (was one link). Group visually by role: the obligation source (with a "view quote" affordance showing the stored `quote`), the fulfillment source, then context. Each links to its live URL **and** its Wayback archive ("archived" link from `verification.json`).
- **Freshness badge** — small, muted: "source confirmed {sourceCheckedOn}". For rows whose ruling age exceeds the staleness window, a "review due" hint.
- **"Under review" pill** — when `verification.json.problems` is non-empty for that row: a visible amber "⚠ under review" state with a tooltip ("a cited source changed or this ruling is being re-checked"). This is a **credibility feature** — showing we catch our own drift, not hiding it.
- **Derived-deadline marker** — the `†` + `derivationNote` per §5.2.
- A new `src/lib/verification.ts` loads `verification.json` and exposes `statusFor(id)`, `archiveFor(id, url)`, `isUnderReview(id)`, and staleness helpers. Build-time only; no client JS needed (badges are static per build, refreshed by the cron's commit-back).

## 9. Review gate / sign-off (gap #8)

Lightweight, enforced in the verify script (so it shows up as a tracked problem rather than blocking work):

- A `resolution: 'missed'` row **must** have `reviewedBy` set and satisfy the missed-sourcing bar (≥2 sources, or a primary `fulfillment`/admission source). Violations → a `problem`.
- `derived` deadlines must carry a `derivationNote`.
- `obligation` sources must carry a non-empty `quote`.

These are *data invariants*; the same checks run in the existing test suite (fast, offline) so authoring mistakes are caught at commit time, while the network checks run weekly in the cron.

## 10. Migration plan (one-time)

1. Add the new types; keep a temporary `primarySource(c): Source` helper returning `c.sources[0]` for components mid-migration.
2. Migrate all **35 rows**: wrap the existing `evidenceUrl`/`sourceLabel` into `sources: [{ url, label, tier, role:'obligation'|'fulfillment', quote }]`. Backfill the **verbatim `quote`** for every obligation source (the highest-effort step — start with the 16 `contested` rows). Add a second `fulfillment` source where a ruling currently leans on one link for both jobs.
3. Set `deadlineBasis: 'derived'` + `derivationNote` on the known derived rows (OpenAI annual review, any trigger-derived dates).
4. Update consumers: `CommitmentCard.astro`, `c/[id].astro`, `csv.ts` (CSV columns: flatten sources to `source_1_url … / archive_url`), `commitments.json` shape (documented as a breaking change in the changelog + methodology).
5. Seed an empty `verification.json`; first cron run populates it.

**Decision (clean break):** the public `commitments.json`/CSV schema changes (single `evidenceUrl` → `sources[]`) with **no compatibility mirror** — the project is new enough that there are effectively no external reusers to break. Document the new shape on the methodology page and announce the schema change in the changelog so any future reuser builds against `sources[]` from the start.

## 11. Testing strategy

- **Offline unit tests** (Vitest, fast — extend the existing 52): quote normalization; staleness threshold math; `computeStatus` trigger-fired path; all §9 data invariants over the real dataset (so a malformed row fails CI immediately); CSV/JSON export shape.
- **Script tests** (`tests/verify-sources.test.js`): feed canned HTML fixtures → assert `ok`/`inconclusive`/`drifted` classification; assert exit-0 default vs `--strict`; assert the issue-body builder groups problems correctly. **No live network in tests** — fetch is injected/mocked.
- The live network checks are exercised only by the cron (and manual `npm run verify`), never in the deploy build.

## 12. Risks & honest limitations

- **JS-rendered / paywalled sources** can't be quote-checked from raw HTML → they degrade to `inconclusive`, requiring a one-time human confirmation. We accept some manual confirmation here rather than false alarms.
- **Wayback coverage isn't guaranteed** — IA can refuse some pages; those rows get a soft "unarchived" note. (Perma.cc remains a future upgrade if this bites.)
- **Triggers can't be auto-detected** — firing is a human catch; automation only nudges via the 180-day flag.
- **Automation never re-judges.** A green verification run means "the evidence still stands," **not** "the verdict is still correct." Re-judging is what the `reviewedOn` staleness clock prompts a human to do.
- **Commit-back loop** must be guarded against ping-pong: the workflow commits only when `verification.json` actually changed. The verify workflow has **no `push` trigger** (only `schedule` + `workflow_dispatch`), so its own commit-back cannot retrigger it — while the deploy workflow, which *does* watch `push`, runs normally and refreshes the badges.

## 13. Out of scope (future)

- LLM-tiered *drift* check (escalate `inconclusive`/`drifted` to a semantic judge) — the deterministic quote-match ships first; the schema leaves room to add it.
- Perma.cc archival upgrade.
- A public "verification status" dashboard page aggregating `verification.json`.

---

# Phases 4–5 — beyond maintaining known rows

Sections 1–13 *maintain rows we already have*. They do not **discover new promises** or **check fulfillment**. These two phases add that, with the same iron rule: **automation proposes with evidence; a human ratifies every verdict.**

## 14. Phase 4 — Discovering new claims

Goal: no new dated promise slips past us unnoticed.

> **Build on what exists.** The repo already ships a tested watcher — `scripts/watch.ts` + `src/watcher/core.ts` (`extractText`/`hashText`/`diffSummary`/`dueDeadlines`/`issueMarker`) + `.watcher/{watchlist.json,state.json,snapshots}` — that fetches a watchlist, diffs against stored snapshots, and opens **deduped GitHub issues** (it does *not* email anyone). Discovery here is an **extension** of that subsystem, not a parallel one.

- **Extend `.watcher/watchlist.json`** (currently 5 pages: Anthropic RSP, OpenAI Preparedness, DeepMind, METR, EU AI Act) with the remaining commitment-bearing pages + Seoul/White House sets.
- The cron **diffs each watched page against the stored snapshot** (existing `core.ts` logic) and additionally Wayback-archives it. Meaningful new dated language → a "🆕 candidate" issue via the existing upsert.
- **Optional LLM extraction** (automated, subscription-billed — §15.1) — for changed pages, extract candidate commitments (quote + lab + date + obligation) instead of eyeballing diffs.
- Output → a `review-queue.json` surfaced in the rolling issue as **"🆕 candidate commitments."** A human promotes a candidate into `commitments.ts`. **No auto-insert** — the no-padding bar is the brand.

**Honest limit:** discovery is only as good as the watchlist. Promises made in interviews, testimony, or social posts we don't watch won't be auto-caught; the watchlist is a maintained artifact, not a crawler of the whole web.

## 15. Phase 5 — Fulfillment-proposal ("was it done?")

Three classes, because "done?" is machine-checkable for some commitments and pure judgment for others:

- **Class A — machine-observable** (most "publish/ship Z by date D" rows). Add an optional `fulfillmentCheck?: { type: 'url-exists' | 'page-contains' | 'changed-since', url, pattern?, by }`. The cron evaluates it deterministically → **proposes** met (artifact present before `by`) or missed/at-risk (deadline passed, nothing found), with the evidence URL. **Free, no LLM, runs in CI.**
  - *Example:* Meta's "framework by the Paris Summit" → `url-exists` on the framework page detects it live 2025-02-03 < 2025-02-10 deadline → proposes **MET**. OpenAI's "20% compute" has no observable artifact → no Class-A check possible.
- **Class B — LLM adjudication** (does the appeared artifact actually *satisfy* the obligation quote?). Runs **automated in the CI cron, subscription-billed** (§15.1), with an automatic fallback to human adjudication if the token is revoked/metered. Proposes met/partial/no + rationale + citation.
- **Class C — human-only** (private facts like compute %, interpretive triggers, adequacy). Automation only monitors `watchUrls` for new reporting and routes to a human. No proposal.

**Invariant (unchanged):** every Class-A/B output is a *proposal in the review queue with evidence + confidence*. A human ratifies before it publishes. No robot ever publishes a "missed."

### 15.1 LLM auth — fully automated, subscription-billed (maintainer's decision, 2026-06-19)

**Decision:** run Class-B adjudication (and Phase-4 extraction) **fully automated in the CI cron, billed to the maintainer's Claude subscription** via a long-lived OAuth token. Maintainer's call, on their own account, for a low-volume (~weekly, a few prompts) non-commercial public-interest project.

**Honest caveat (recorded, not re-litigated):** the Consumer Terms frame a subscription as individual *interactive* use and lean against automated/scheduled use; Anthropic pausing / not shipping the separate headless credit pool (June-15-2026) is *not* an explicit grant of permission. Realistic exposure is **account-level** (throttling or a ToS nudge), not legal. The design is built to fall back cleanly if that ever bites.

**Mechanism:**
- One-time: `claude setup-token` (interactive browser OAuth) → ~1-year token → store as GitHub secret **`CLAUDE_CODE_OAUTH_TOKEN`** (never committed).
- The adjudication job installs Claude Code (`npm i -g @anthropic-ai/claude-code`, pin the version) and runs headless: `claude -p "<prompt>" --output-format json`, with `CLAUDE_CODE_OAUTH_TOKEN` set and **`ANTHROPIC_API_KEY` deliberately *unset*** in that job. (Auth precedence puts `ANTHROPIC_API_KEY` *ahead* of `CLAUDE_CODE_OAUTH_TOKEN` — if both are present the API key wins and you'd be billed the metered API instead of the subscription.) Call the CLI directly in a workflow step, not via `anthropics/claude-code-action` (which doesn't support the OAuth token).
- **Graceful degradation (required):** wrap the call; on `authentication_failed` / 401 / any non-zero exit → skip adjudication, **`exit 0`**, leave the candidates in the review queue tagged "needs manual adjudication," and append the rolling issue. A revoked or newly-metered token therefore **never breaks the cron** — it silently reverts that week's Class-B to human judgment.
- **Clean swap-out:** the step reads auth from env only. To move to the sanctioned metered path later, set `ANTHROPIC_API_KEY` as the secret instead — one-line change, no code edits.
- **Token rotation:** ~1-year expiry; the 401-detect path opens an issue "re-mint via `claude setup-token`."

So: **deterministic detection + LLM judgment are both automated in CI; judgment is subscription-billed with an automatic, lossless fallback to human adjudication.**

---

## Decisions (all resolved — 2026-06-19)

1. Staleness windows — **30 days (contested/unresolved) / 180 days (resolved)**.
2. Schema — **clean break**, `evidenceUrl` → `sources[]`, **no compatibility mirror**.
3. Cron cadence — **daily full run + optional 6-hourly hot-row pass** (cost ≈ 0 on a public repo; live timers are client-side anyway).
4. Scope — **all 5 phases in a single implementation plan** (maintenance core + discovery + fulfillment together).
