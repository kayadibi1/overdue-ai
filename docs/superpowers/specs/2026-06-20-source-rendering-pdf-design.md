# Closing the Inconclusive-Quote Gap — Design Spec (v2, post-adversarial-review)

**Date:** 2026-06-20
**Status:** Design (awaiting review) → implementation plan
**Goal:** Make the currently-inconclusive obligation quotes drift-checkable with **zero new infrastructure** — via PDF text extraction, targeted source re-pointing, and a `synthesized` flag — then *measure the residual* before deciding whether any browser-rendering is justified at all.

---

## 0. What changed from v1 (the adversarial review killed the Worker)

v1 proposed a Cloudflare Browser Rendering Worker as the centerpiece. An adversarial review + direct verification disproved its premises:

| v1 assumption | Reality (verified 2026-06-20) |
|---|---|
| "Repo already ships Workers + wrangler" | **False** — `overdue-ai` has no `wrangler.*`/`workers/`. A Worker here is greenfield. (I confused it with another project's Workers.) |
| PDFs are blocked → need rendering | **False** — all 4 PDF sources return `200 / application/pdf / 190–304 KB`. A byte-fetch + `unpdf` reads them. No browser. |
| "Cloudflare Browser Rendering, free tier" | **False** — Browser Rendering requires **Workers Paid ($5/mo)** with a ~10-min/day free cliff; plus an SSRF surface (redirect bypass) and a Chrome-tracking dependency to maintain. |

**Conclusion:** rendering is **not** the lever. PDF extraction + re-pointing + `synthesized` resolve the large majority of inconclusive rows with no infra, no cost, no security surface. Rendering is deferred to §6 behind a "prove ≥3 sources genuinely need a browser" gate — which the data suggests won't trigger.

## 1. The three no-infra levers

### Lever A — PDF text extraction
Add `unpdf` (pure-JS, no native deps, no browser). When a source URL is a PDF (extension `.pdf` or `content-type: application/pdf`), fetch the bytes and `extractText`, then run the existing `classifyQuote` against the extracted text.

Unlocks (4 distinct PDFs, ~8 rows): `x.ai/...RMF-Draft.pdf` (xai-updated-policy), `storage.googleapis.com/...fsf-technical-report.pdf` (deepmind-fsf-eval-cadence), `bidenwhitehouse.../Voluntary-AI-Commitments...pdf` (the 5 White House rows' obligation source), `cdn-dynmedia-1.microsoft.com/...Frontier-Governance-Framework.pdf` (microsoft).

### Lever B — Targeted re-pointing to the clause-bearing document
Several obligations cite a **landing/changelog/blog** page whose clause actually lives in a linked **PDF** (now readable via Lever A). Re-point the obligation `url` to that PDF + quote the verbatim clause; keep the landing page as a `context`/`fulfillment` source where useful:
- **Anthropic RSP rows** (`anthropic-asl4-before-asl3`, `anthropic-eval-cadence`, `anthropic-risk-report-next`, `anthropic-annual-procedural-review`) cite `/news/...rsp` or `/rsp-updates`; re-point to the **RSP policy PDF** (the version-appropriate PDF — v1.0 for the ASL-4 clause, v3.x for the cadence/report clauses). *(Exact PDF URLs confirmed during implementation; the RSP PDFs are linked from those pages.)*
- **`deepmind-fsf-early-2025`** cites the **v2** update blog for a **v1.0** "early 2025" clause; re-point to the **v1.0 FSF PDF** (the same `storage.googleapis.com/...fsf-technical-report.pdf` already cited by `deepmind-fsf-eval-cadence`, confirmed `200`).
- **`openai-preparedness-annual-review`** cites the blog summary; the "review at least once a year" clause is in the **Preparedness Framework PDF** (`cdn.openai.com/...preparedness-framework-v2.pdf` or the "Read full document" link) — re-point if that PDF is fetchable (confirm during implementation; if not, leave inconclusive — it's a derived-deadline row anyway).

### Lever C — `synthesized` flag for paraphrased / clause-less obligations
Add `Source.synthesized?: boolean`. When true, the obligation has **no single verbatim public clause** (it's our faithful summary of an aspirational/multi-part commitment); the checker **skips quote-drift** for it (records `quoteCheck: 'n/a'`, never `inconclusive`), and the methodology/UI label it honestly ("obligation summarized; see source").
- **`uk-aisi-predeployment`** — "pre-deployment access for state safety institutes" is our paraphrase of the aspirational Bletchley Declaration; no verbatim clause exists. → `synthesized: true`.
- Any other obligation where, after Levers A/B, no verbatim phrase can be confirmed in the source.

## 2. Component changes (all in-repo, no infra)

- `package.json` — add `unpdf` (dependency).
- `src/watcher/pdf.ts` (new) — `extractPdfText(buf: ArrayBuffer): Promise<string>` via `unpdf`; never throws; testable on a tiny committed fixture PDF.
- `src/watcher/verify-fetch.ts` — in `fetchVerifiable`, branch on PDF first: if the URL ends `.pdf` OR a `HEAD`/`GET` returns `content-type: application/pdf`, fetch bytes → `extractPdfText` → `{ text, via: 'pdf', dead: false }`. (Existing live→archive HTML path unchanged. **No render branch.**)
- `src/watcher/checks.ts` — honor `synthesized` (skip `classifyQuote`, set `quoteCheck: 'n/a'`, no problem); the `'n/a'` value must be added to the `SourceState.quoteCheck` union in `src/lib/verify/schema.ts` + `parseVerification` guard.
- `src/lib/types.ts` — `Source.synthesized?: boolean`.
- `src/data/commitments.ts` — Lever B re-points + verbatim PDF-clause quotes; Lever C `synthesized` flags.
- `src/components/CommitmentCard.astro` / `c/[id].astro` — render a small "obligation summarized" note when `synthesized` (optional, low priority).
- `src/pages/methodology.astro` — one line: PDFs are read via a text extractor; aspirational obligations with no verbatim clause are labeled and not drift-checked.

## 3. The escalation refactor is NOT needed

v1's "quote-aware escalation" (re-fetch via render when a quote isn't found) only existed to feed the render path. With no render path, **`runChecks` keeps its current single-fetch-per-source shape** — `fetchVerifiable` just gains a PDF branch. No `FetchFn` signature change, no render budget, no caching of `via` for cost control. (This removes a whole class of complexity the review flagged.)

## 4. Honest coverage after Levers A–C

- **PDF rows (~8):** resolved by Lever A.
- **Re-pointed rows (~6):** resolved by Levers A+B (the clause PDF is readable).
- **Bletchley + clause-less (~1–2):** resolved by Lever C (`n/a`, not inconclusive).
- **Residual = genuinely-blocked HTML sources** whose CI fetch is 403'd and whose Wayback snapshot differs — candidates: **gov.uk Seoul** (covers 6 rows, *one* source) and **NIST** (1 source), *if* they're actually CI-blocked. These are the ONLY cases a browser/render would help.

## 5. Mandatory: measure the residual (the gate)

After Levers A–C ship and one CI run completes, produce a **residual table** from `verification.json`: every source still `inconclusive`, with its HTTP status from CI and whether the Wayback fallback differs. This is the **decision input** for §6. Do not build any rendering infra before this table exists. (The local-vs-CI fetch divergence is real — a quote verified locally can read inconclusive in CI when CI is blocked; the authoritative signal is the checker's own `quoteCheck`, so the residual must be read from `verification.json`, not a local check.)

## 6. Deferred: rendering — only if the residual proves it

Open ONLY if the §5 residual shows **≥3 distinct sources** that are CI-blocked AND have no usable Wayback snapshot AND carry a real obligation quote. If so, write a *separate* spec, and at that point re-evaluate honestly (corrected facts):
- **Cloudflare Browser Rendering needs Workers Paid ($5/mo)**; the render Worker is **greenfield** here (new wrangler project, deploy pipeline, a CI secret); it's an **authenticated headless browser fetching arbitrary URLs** (SSRF — note the **redirect bypass**: an allow-listed hostname can 302 to an internal/metadata URL that Puppeteer follows, so an allow-list on the *initial* URL is insufficient; need redirect interception or a deny-list of private ranges, and verify whether CF's edge sandbox even exposes metadata endpoints).
- Cheaper alternatives to weigh first: a better/forced **Wayback capture** (Save-Page-Now of the live page on demand, which we already do for archival — the fresh snapshot may render fine and we already fetch it), or simply **accepting** that 1–2 blocked-HTML sources stay `inconclusive` (silent, no false alarm) — which may be entirely acceptable for the cost.

## 7. Testing

- `extractPdfText` on a tiny committed fixture PDF → known text (offline).
- `fetchVerifiable` PDF routing with injected fetch/extract (PDF content-type → pdf branch; HTML unchanged) (offline).
- `synthesized` → `quoteCheck:'n/a'`, no problem, in `runChecks` (offline, injected fetch).
- `parseVerification` accepts `'n/a'`.
- Post-merge: one CI run → confirm PDF + re-pointed rows flip to `ok`, `synthesized` rows show `n/a`, and produce the §5 residual table.

## 8. Risks & honest limits
- **Image-only PDFs** (scanned, no text layer) → `unpdf` returns little → stay inconclusive. (Rare for policy docs; ours are text PDFs.)
- **Re-point PDF URLs may move** — pin the exact PDF URL; the checker's link-health catches a 404.
- **OpenAI preparedness PDF** may itself be Cloudflare-fronted — confirm fetchable during implementation; if blocked, that row joins the residual (acceptable — derived deadline).
- **The cheapest correct answer may be "accept the residual"** — if Phase 1 leaves only 1–2 silent-inconclusive sources, building anything more is likely not worth it.

## Decisions (resolved)
1. Rendering — **deferred** behind the §5 residual gate; not built in this phase. (The earlier "Cloudflare Browser Rendering" choice is moot unless the residual proves ≥3 sources need it, and would then be re-evaluated against the corrected $5/mo + SSRF facts.)
2. Re-pointing — **targeted only** (RSP/DeepMind/OpenAI rows + Bletchley), unchanged.
3. `synthesized` — **skip-drift + label**, unchanged.
