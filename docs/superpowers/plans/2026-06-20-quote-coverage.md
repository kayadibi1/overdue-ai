# Closing the Inconclusive-Quote Gap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Make the inconclusive obligation quotes drift-checkable with **zero new infrastructure** — PDF text extraction, targeted re-pointing, and a `synthesized` flag — then measure the residual.

**Architecture:** Extend the existing checker (`src/watcher/`) only. `fetchVerifiable` gains a PDF branch (`unpdf`, byte-fetch). A `synthesized` source skips quote-drift. A few obligations re-point to the clause-bearing PDF. No Worker, no render, no new external service.

**Tech Stack:** Astro + TS, Vitest (node), Node 22, `tsx`, `unpdf` (new dep), cheerio (existing).

**Spec:** `docs/superpowers/specs/2026-06-20-source-rendering-pdf-design.md` (v2, post-adversarial-review).

---

## File Structure
**New:** `src/watcher/pdf.ts` (`extractPdfText`, `isPdfUrl`), `tests/verify-pdf.test.ts`.
**Modified:** `src/lib/types.ts` (`Source.synthesized?`), `src/lib/verify/schema.ts` (`'n/a'` in `quoteCheck`), `src/watcher/verify-fetch.ts` (PDF branch), `src/watcher/checks.ts` (honor `synthesized`), `src/data/commitments.ts` (re-points + quotes + flags), `src/pages/methodology.astro`, `src/components/CommitmentCard.astro`, `package.json`, `CHANGELOG.md`. Tests: `tests/verify-checks.test.ts`, `tests/verify-loader.test.ts`, `tests/verify-fetch.test.ts`.

---

## Task 0: Branch
- [ ] `git checkout main && git pull && git checkout -b feat/quote-coverage`. Confirm baseline: `npx vitest run` + `npm run build` green.

## Task 1: `synthesized` field + `'n/a'` quoteCheck
**Files:** `src/lib/types.ts`, `src/lib/verify/schema.ts`; Test `tests/verify-loader.test.ts`

- [ ] **Step 1:** Failing test — `parseVerification` accepts a source with `quoteCheck:'n/a'` (round-trips), and still rejects an invalid value (e.g. `'maybe'`) → `{rows:{}}`.
- [ ] **Step 2:** Run → FAIL (`'n/a'` not yet allowed).
- [ ] **Step 3:** `types.ts`: add `synthesized?: boolean;` to `Source`. `schema.ts`: widen `SourceState.quoteCheck` to `'ok' | 'inconclusive' | 'drifted' | 'n/a'`, and update the `parseVerification` guard's allowed-values check to include `'n/a'`.
- [ ] **Step 4:** Run → PASS; full `npx vitest run` green.
- [ ] **Step 5:** Commit (`feat(verify): add synthesized flag + n/a quoteCheck`).

## Task 2: checks.ts honors `synthesized`
**Files:** `src/watcher/checks.ts`; Test `tests/verify-checks.test.ts`

- [ ] **Step 1:** Failing test — a source with `synthesized:true` (and a quote) → `quoteCheck:'n/a'`, NO `classifyQuote` call, NO problem; the row isn't flagged.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** In the `runChecks` source loop, before the obligation/quote branch: `if (s.synthesized) { quoteCheck = 'n/a'; }` and skip the `classifyQuote` path (guard the existing `else if (s.role === 'obligation' && s.quote)` with `&& !s.synthesized`). A dead link on a synthesized source is still a problem (link health is independent).
- [ ] **Step 4:** Run → PASS; full suite green.
- [ ] **Step 5:** Commit.

## Task 3: PDF extraction (`unpdf`)
**Files:** `package.json`, `src/watcher/pdf.ts` (new); Test `tests/verify-pdf.test.ts`

- [ ] **Step 1:** `npm install unpdf` (adds dependency).
- [ ] **Step 2:** Create `src/watcher/pdf.ts`:
```ts
import { extractText, getDocumentProxy } from 'unpdf';

/** Extract text from PDF bytes (whitespace-joined). Never throws → '' on failure. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join(' ') : text).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}
```
- [ ] **Step 3:** Failing test `tests/verify-pdf.test.ts` for the PURE helper: `isPdfUrl('https://x/a.pdf')` true, `isPdfUrl('https://x/a.pdf?v=1')` true, `isPdfUrl('https://x/a.html')` false. (Do NOT unit-test `extractPdfText` against a hand-crafted fixture — pdfjs is finicky about minimal PDFs; it's a thin wrapper verified by Step 4 + the post-merge CI check.)
- [ ] **Step 4:** Run the test → PASS. Then **manually verify `extractPdfText` works** against a real source:
  `npx tsx -e "import {extractPdfText} from './src/watcher/pdf'; (async()=>{const r=await fetch('https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf'); const t=await extractPdfText(new Uint8Array(await r.arrayBuffer())); console.log(t.length,'chars:',t.slice(0,200))})()"`
  Expected: hundreds+ of chars of real commitment text. Record the result in the commit message.
- [ ] **Step 5:** Commit (`feat(verify): unpdf PDF text extraction`).

## Task 4: `fetchVerifiable` PDF branch
**Files:** `src/watcher/verify-fetch.ts`; Test `tests/verify-fetch.test.ts`

- [ ] **Step 1:** Failing tests — `fetchVerifiable` on a `.pdf` URL routes to PDF extraction (injected) → `{text:'pdf text', via:'pdf', dead:false}`; an HTML URL keeps the existing live/archive behavior unchanged; a PDF whose extract returns `''` → `{text:null, via:'none', dead:false}` (inconclusive, not crash).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add a PDF branch at the TOP of `fetchVerifiable`, with an injectable extractor (default = real fetch + `extractPdfText`):
```ts
// deps: { live?, archive?, pdf? }  where pdf(url) => Promise<string|null>
if (isPdfUrl(url)) {
  const pdf = deps.pdf ?? (async (u: string) => {
    const r = await fetchWithStatus(u);                // status only; we need bytes:
    // (implementation: do a real arrayBuffer fetch here, 25s timeout, browser UA)
    ...
  });
  const text = await pdf(url);
  return text ? { text, via: 'pdf', dead: false } : { text: null, via: 'none', dead: false };
}
```
Implement the default `pdf` as: `fetch(url, {headers: browser UA, signal: AbortSignal.timeout(25000)})` → if `!res.ok` return null → `extractPdfText(new Uint8Array(await res.arrayBuffer()))` → return text or null. Never throws.
- [ ] **Step 4:** Run → PASS. Update `tests/verify-checks.test.ts`/`tests/verify-fulfillment.test.ts` only if the injected `fetchFn` shape changed (it shouldn't — `checks.ts` still calls `fetchVerifiable`). Full suite green; `npm run build` green; `npm run watch -- --dry-run` runs.
- [ ] **Step 5:** Commit (`feat(verify): fetchVerifiable reads PDF sources`).

## Task 5: Lever B — re-point to clause-bearing PDFs (MINE — judgment)
**Files:** `src/data/commitments.ts`

For each row below: find the PDF that contains the verbatim clause, confirm it's fetchable (`200`/`application/pdf`), extract its text (reuse the Task-3 `extractPdfText` via a throwaway `npx tsx -e` dump), pick a verbatim phrase, and re-point the obligation `url` + `quote` (keep the old landing page as a `context` source if useful). Rows:
- [ ] `deepmind-fsf-early-2025` → re-point obligation to `storage.googleapis.com/...fsf-technical-report.pdf` (the v1.0 FSF PDF, already cited by `deepmind-fsf-eval-cadence`, confirmed `200`); quote the verbatim "early 2025 / fully implemented" phrase from the PDF (or, if the PDF says it differently, the actual clause).
- [ ] `anthropic-asl4-before-asl3`, `anthropic-eval-cadence`, `anthropic-risk-report-next`, `anthropic-annual-procedural-review` → find the RSP policy PDF (linked from `/rsp-updates`; version-appropriate), confirm fetchable, quote the verbatim clause for each.
- [ ] `openai-preparedness-annual-review` → find the Preparedness Framework PDF ("Read full document" link); IF fetchable, re-point + quote the "review … at least once a year" clause; IF blocked/unavailable, leave as-is (it joins the residual — acceptable, derived deadline).
- [ ] After each re-point, dump the PDF text and confirm `normalize(quote)` is a substring (same check the checker uses) BEFORE committing.
- [ ] Run full `npx vitest run` (data invariants — every obligation still has a quote) + `npm run build` green. Commit (`refactor(data): re-point RSP/DeepMind/OpenAI obligations to clause-bearing PDFs`).

## Task 6: Lever C — `synthesized` data flags (MINE)
**Files:** `src/data/commitments.ts`

- [ ] Set `synthesized: true` on the `uk-aisi-predeployment` obligation source (Bletchley paraphrase, no verbatim clause). Add `synthesized: true` to any other obligation where Task 5 could not confirm a verbatim phrase.
- [ ] Confirm the data invariant still holds (synthesized obligations keep their `quote` text for human reference — the invariant requires a non-empty quote, which they have). Run suite + build. Commit (`data: synthesized flag for paraphrased obligations`).

## Task 7: Methodology + UI note + CHANGELOG
**Files:** `src/pages/methodology.astro`, `src/components/CommitmentCard.astro` (+ `c/[id].astro`), `CHANGELOG.md`

- [ ] Methodology: one line — PDFs are read via a text extractor; aspirational obligations with no verbatim clause are labeled and not drift-checked.
- [ ] Card/detail (optional, low priority): when a source is `synthesized`, show a small "obligation summarized — see source" note.
- [ ] CHANGELOG entry (newest-first): "Quote-drift now covers PDF sources (via `unpdf`) and re-pointed RSP/DeepMind/OpenAI obligations; paraphrased obligations (e.g. Bletchley) are labeled `synthesized` and exempt from drift."
- [ ] `npm run build` + full `npx vitest run` green. Commit.

## Merge gate
- [ ] Full `npx vitest run` green; `npm run build` + `PAGES=1 npm run build` green; `npm run watch -- --dry-run` clean; `npx tsc --noEmit` clean.
- [ ] Merge `--no-ff` to `main` (author `kayadibi1 <sidarvig@gmail.com>`); push.

## Task 8 (POST-MERGE): the residual gate
- [ ] After one CI verify run completes, read `src/data/verification.json` from `origin/main` and produce the **residual table**: every source still `inconclusive`, with (from a quick local curl) its CI-relevant HTTP status and whether a usable Wayback snapshot exists. 
- [ ] **Decision:** if ≥3 distinct sources are genuinely CI-blocked, carry a real obligation quote, AND have no usable snapshot → open a *separate* rendering spec (re-evaluating CF Browser Rendering's $5/mo + SSRF facts vs. a forced-Wayback-capture alternative vs. simply accepting the residual). Otherwise → **accept the residual** (inconclusive is silent; no false alarms) and close this out.

## Self-Review
- Spec coverage: Lever A (T3–4), Lever B (T5), Lever C (T1–2 mechanism + T6 data), residual gate (T8). ✓
- No infra introduced: only `unpdf` dep + in-repo code. ✓
- `'n/a'` added consistently to the type, the schema guard, and `checks.ts`. ✓
- PDF fetch never throws (byte-fetch + extract both guarded). ✓
- Data invariants preserved (obligations keep non-empty quotes). ✓

## Repo policy
Commit author `kayadibi1 <sidarvig@gmail.com>`; explicit `git add` paths only; all dev on `feat/quote-coverage`; merge at the gate.
