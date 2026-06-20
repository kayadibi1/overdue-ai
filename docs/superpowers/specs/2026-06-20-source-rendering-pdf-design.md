# Source Rendering, PDF Extraction & Targeted Re-pointing — Design Spec

**Date:** 2026-06-20
**Status:** Design (awaiting review) → adversarial review → implementation plan
**Goal:** Extend the verification checker so quote-drift detection works for the ~17 currently-inconclusive obligation sources — **PDFs**, **JS-rendered pages**, and **Cloudflare-blocked pages** — sustainably (low ongoing cost + maintenance), plus a small targeted data-hygiene pass for genuinely-wrong sources.

---

## 0. Locked decisions

| Fork | Choice | Why |
|---|---|---|
| JS-rendered / blocked-page rendering | **Cloudflare Browser Rendering** via a small Worker | On the existing CF stack; sidesteps CF 403 (CF→CF); low maintenance; no broad API token in CI (Worker holds the binding, checker calls it with a shared secret) |
| PDF text | **Pure-JS extractor (`unpdf`)** in the checker | No browser, no native deps; runs in CI; unlocks the 8 PDF sources |
| Lever 1 (re-pointing) | **Targeted only** | Lever 2 reads existing sources in place; re-point ONLY genuinely-wrong sources |

## 1. The reframe: Lever 2 subsumes Lever 1

A source is "inconclusive" because the checker (static `fetch` + cheerio) can't see the clause. Three causes, each fixed by **reading the source better**, not by swapping it:
- **PDF** (8 sources) → fetch bytes, extract text with `unpdf`.
- **JS-rendered** (EU AI Act site, mid-redesign) → render via the CF Worker, then extract.
- **Cloudflare-blocked 403** (Hogan Lovells, OpenAI) → render via the CF Worker (CF→CF beats the block), or the existing Wayback fallback.

So **Lever 1 (re-pointing) is NOT the main mechanism** — Lever 2 is. Lever 1 shrinks to *targeted* fixes for sources that are the *wrong document* or a *paraphrase with no verbatim phrase anywhere* (§6).

## 2. Current state (baseline)

`src/watcher/`: `core.ts` (`fetchWithStatus`→`{text,status}`, `extractText` via cheerio, `fetchHtml`), `verify-fetch.ts` (`fetchVerifiable`: live → Wayback-snapshot fallback → `{text,via,dead}`), `checks.ts` (`runChecks` → source-health + quote-drift via `classifyQuote`), `wayback.ts` (`archive`, `fetchSnapshotText`). The cron (`scripts/watch.ts`) writes `verification.json`; `scripts/adjudicate.mjs` does Class-B. ~28 sources currently drift-checkable; ~17 inconclusive (9 HTML-hard + 8 PDF).

## 3. Architecture — a multi-strategy resolver

`fetchVerifiable` becomes content-aware, escalating only when needed (cost control):

```
fetchVerifiable(url, { quote? }):
  1. PDF?  (url ends .pdf OR HEAD content-type application/pdf)
       → fetch bytes → unpdf extractText → { text, via:'pdf', dead:false }
  2. Static live fetch (fetchWithStatus)
       2xx + HTML:
          quote given AND found in cheerio(extractText)? → { via:'live' }   (done — no render)
          quote given AND NOT found, OR looks like a shell → escalate to RENDER (step 4)
          no quote → return live text
       404/410 → { dead:true }
       403 / 5xx / network → escalate to RENDER (step 4)
  3. (escalation budget check — see §5)
  4. RENDER via the CF Worker → rendered HTML → cheerio extract → { via:'render' }
  5. RENDER failed → Wayback snapshot (existing fetchSnapshotText / stored archiveUrl) → { via:'archive' }
  6. all failed → { text:null, via:'none', dead:false }
```

**Quote-aware escalation** (step 2) is the key cost lever: a source whose quote the *static* fetch already satisfies is **never rendered**. Only the ~9 JS/blocked sources escalate. `via` is recorded in `verification.json` so it's visible which path each used.

## 4. The CF Browser Rendering Worker

New Worker `workers/render/` (the repo already ships Workers + wrangler):

```js
import puppeteer from '@cloudflare/puppeteer';
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.headers.get('x-render-key') !== env.RENDER_KEY) return new Response('forbidden', { status: 403 });
    const target = u.searchParams.get('url');
    if (!target || !/^https?:\/\//.test(target)) return new Response('bad url', { status: 400 });
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const page = await browser.newPage();
      await page.goto(target, { waitUntil: 'networkidle0', timeout: 25_000 });
      const html = await page.content();
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    } catch (e) {
      return new Response(`render error: ${e}`, { status: 502 });
    } finally {
      await browser.close();
    }
  },
};
```

`wrangler.toml`: `browser = { binding = "BROWSER" }`, route e.g. `render.overduetracker.org/*` (or a `*.workers.dev` URL). **Auth: a shared secret** `RENDER_KEY` (Worker secret + GitHub Actions secret) — the Worker renders arbitrary URLs, so it MUST be auth-gated or it's an open browser proxy. Deploy via `wrangler deploy`.

The checker (CI) calls `GET https://render.overduetracker.org/?url=<enc>` with header `x-render-key: <secret>`.

## 5. Cost & sustainability controls (the core of "sustainable")

Cloudflare Browser Rendering has a **free daily allotment**; beyond it, paid. To stay free and low-maintenance:
- **Render only on escalation** (§3 step 2) — never render a source the static fetch already satisfies. Steady state: ~9 renders/run.
- **Per-run render cap** (e.g. `RENDER_CAP=15`) — log any deferrals (no silent truncation); carry to next run.
- **Daily cadence for rendering** — the 6-hourly hot-row pass does NOT render (static + Wayback only); only the daily full run renders. Keeps renders ≤ ~9–15/day, comfortably in free tier.
- **Cache the working `via` per source** — if a source rendered successfully and the quote was found, store that; re-render only periodically (e.g. weekly) to catch drift, not every run.
- **Graceful degradation** — Worker down / over budget / timeout → fall through to Wayback → inconclusive (never a hard failure, never blocks the cron).
- PDF extraction is free (CPU only) — no cap needed; cache extracted text hash like HTML.

**Budget statement (no silent caps):** the run logs `rendered N/cap, deferred M, pdf-extracted K`. If renders are deferred for budget, that's surfaced.

## 6. Lever 1 — targeted re-pointing (small, explicit)

Only these, with a written criterion:
- **`uk-aisi-predeployment`** (Bletchley) — "pre-deployment access for state safety institutes" is *our paraphrase*; the Bletchley Declaration has no such verbatim clause (it's aspirational). Action: find a verbatim Bletchley phrase if one exists; else mark the obligation `synthesized: true` (new optional flag) so the checker skips quote-drift for it (no false inconclusive) and the UI notes "obligation summarized from an aspirational declaration."
- **`deepmind-fsf-early-2025`** — cites the **v2** update blog for a **v1.0** "early 2025" clause. Action: re-point the obligation source to the FSF **v1.0** document (PDF → now readable via Lever 2) and quote the verbatim v1.0 phrase; keep the v2 blog as a `fulfillment` source.
- **`anthropic-asl4-before-asl3`, `anthropic-eval-cadence`, `anthropic-risk-report-next`, `anthropic-annual-procedural-review`** — cite landing/changelog pages (`/news/...rsp`, `/rsp-updates`) whose clause lives in the **RSP policy PDF**. Action: re-point each obligation to the **RSP PDF** (now readable via Lever 2) + the verbatim clause; keep the landing page as context if useful.
- **`new optional field`** `Source.synthesized?: boolean` — when true, the obligation has no verbatim public clause (paraphrased); the checker skips quote-drift (records `quoteCheck:'n/a'`, never inconclusive) and the methodology/UI label it honestly.

Everything else (OpenAI preparedness, the PDFs, EU AI Act) is read in place by Lever 2 — no re-pointing.

## 7. Data-model changes

- `Source.synthesized?: boolean` (§6).
- (optional) `Source.fetchMode?: 'static' | 'render' | 'pdf' | 'auto'` — default `auto` (the resolver decides). A manual override only if auto-detection mis-routes a specific source. Prefer auto; add the field only if needed.
- `verification.json` `SourceState` gains `via?: 'live'|'render'|'pdf'|'archive'` (already partly there) so the path is auditable.

## 8. Component changes

- `package.json` — add `unpdf` (dependency) + `@cloudflare/puppeteer` (workers devDep) + a `wrangler` deploy script for the render worker.
- `src/watcher/pdf.ts` (new) — `extractPdfText(buf): Promise<string>` via `unpdf`; pure-ish, testable on a fixture PDF.
- `src/watcher/render-client.ts` (new) — `renderText(url, {key,endpoint,timeout}): Promise<string|null>` — calls the Worker, returns rendered HTML→never throws.
- `src/watcher/verify-fetch.ts` — the multi-strategy resolver (§3), incl. the render-budget counter (injected).
- `src/watcher/checks.ts` — pass the quote into `fetchVerifiable` for quote-aware escalation; honor `synthesized` (skip drift); record `via`.
- `scripts/watch.ts` — provide the render client (env `RENDER_URL`/`RENDER_KEY`), the budget cap, and the daily-vs-hot-row render gate.
- `scripts/adjudicate.mjs` — reuse the render path for Class-B artifact fetch (so adjudication can read JS/blocked artifacts too), behind the same budget.
- `.github/workflows/verify-sources.yml` — pass `RENDER_URL`/`RENDER_KEY` secrets to the verify + adjudicate steps.
- `workers/render/` + `wrangler.toml` — the Worker (§4).
- `src/pages/methodology.astro` — one line: "JS-rendered and PDF sources are read via a headless renderer / PDF extractor; aspirational obligations with no verbatim clause are labeled and not drift-checked."

## 9. Security

- The render Worker is an **authenticated headless browser that fetches arbitrary URLs** — classic SSRF/open-proxy risk. Mitigations: (a) **shared-secret auth** (`x-render-key`); (b) **hostname allow-list** — the Worker renders ONLY hostnames present in the committed dataset (derived from `commitments.json` source URLs, baked into the Worker at deploy or read from a small committed allow-list), so it can't be pointed at internal/metadata/arbitrary endpoints; **scheme-restricted** to http/https; (c) a **per-Worker rate limit** (CF rate-limiting rule); (d) the secret stored as a Worker secret + GH Actions secret, never in the repo. (Consistent with the existing locked-down CF posture.)
- No broad CF API token in CI (the Worker holds the Browser binding; CI only holds the Worker URL + shared secret).

## 10. Testing

- **Offline/pure:** `extractPdfText` on a tiny committed fixture PDF → asserts known text; the resolver's routing logic (PDF vs static vs escalate vs dead) with injected fetch/render/pdf fns → asserts the right path per status; `synthesized` skips drift; budget cap deferral.
- **No live network in unit tests** (inject everything).
- **Worker:** a local `wrangler dev` smoke test (render a known JS page → text present) — manual/CI-optional.
- **End-to-end:** a manual `workflow_dispatch` run after deploy confirms the ~9 inconclusive sources flip to `ok` (or `n/a`), renders stay within budget, and nothing regresses. (First live render validation is post-merge, like the verify workflow — GitHub can't dispatch a branch-only workflow.)

## 11. Rollout / phases

1. **PDF extraction** (smallest, no external infra) — `unpdf` + resolver PDF branch + the 8 PDF sources flip to checkable. Ship + verify first.
2. **Render Worker** — build + `wrangler deploy` + secret; wire `render-client` + resolver escalation; the JS/blocked sources flip. (You drive the `wrangler deploy` + secret-set; I can't.)
3. **Targeted re-point** (§6) — the Bletchley/DeepMind/Anthropic-RSP rows + the `synthesized` flag.
4. **Class-B render** — let adjudication use the render path too.

Phases 1 and 3 need no new infra; phase 2 needs the Worker deployed + the `RENDER_KEY` secret (yours to run, like the OAuth token).

## 12. Risks & honest limits

- **Browser Rendering free-tier limits** — if exceeded, renders defer (logged) → those rows stay inconclusive that day, not broken. Monitor; the cap + daily-only cadence keep us well under for ~9–15 renders/day.
- **Render flakiness** — `networkidle0` can time out on heavy pages; the 25s timeout + Wayback fallback contain it.
- **PDF extraction quality** — scanned/image PDFs have no text layer (`unpdf` returns little); those stay inconclusive (rare for policy docs).
- **Worker maintenance** — one more Worker to own; `@cloudflare/puppeteer` API can change. Low but non-zero.
- **The EU AI Act site is mid-redesign** — even rendered, the quote may legitimately have changed → the checker would correctly report `drifted` (working as intended), and we re-verify the quote.
- **Local-vs-CI fetch divergence (observed):** a quote verified against a clean *local* fetch can still read `inconclusive` in CI when CI's IP is blocked and the Wayback snapshot the CI fetch falls back to differs (older/cookie-walled). The render path (CF→CF, hostname-allow-listed) closes this for the allow-listed sources; until a source renders, treat local quote-verification as **necessary but not sufficient** — the authoritative signal is the checker's own `quoteCheck` in `verification.json`. (This is why §10 e2e verification asserts against `verification.json`, not a local check.)

## 13. Out of scope
- A third-party scraping API (rejected for cost/dependency).
- Re-pointing sources that Lever 2 already reads (per the targeted-only decision).
- OCR for image-only PDFs.

---

## Decisions (resolved 2026-06-20)
1. **Render cadence:** daily-only renders; the 6-hourly hot-row pass stays static + Wayback only (keeps renders ≤ ~9–15/day, inside the free tier).
2. **Worker SSRF posture:** hostname allow-list restricted to dataset source hostnames (+ scheme-only) — not an open renderer.
3. **`synthesized` obligations:** skip drift + label honestly (record `quoteCheck:'n/a'`, never inconclusive); do **not** drop the quote text (kept for human reference).
