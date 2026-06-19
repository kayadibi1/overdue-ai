# UI/UX Polish Implementation Plan

> **For agentic workers:** presentational pass — verify by build + browser, not TDD (no new pure logic). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement all approved UI/UX review findings (subscribe styling, button system, scorecard color + correct interactivity, table discoverability, detail-page casing/copy/nav, favicon, contested de-emphasis).

**Architecture:** Static Astro 5. Changes are CSS (`global.css`, scoped `table.astro` style), small markup edits, one component prop (`SummaryStats.interactive`), one new DOM island (`scripts/cite.ts`), and one new asset (`public/favicon.svg`). No shared-layout refactor.

**Tech Stack:** Astro, TypeScript, plain CSS, Vitest (regression), pytest (regression).

---

### Task 1: Button system + subscribe form styling
**Files:** Modify `src/styles/global.css`; `src/components/Subscribe.astro`.
- [ ] Add `.btn` (pill, accent `--upcoming`, white text, hover brightness, focus ring) + `.btn--ghost` (panel bg, `--line` border, ink text) to `global.css`.
- [ ] Add `.subscribe` rules: flex row (`align-items:center; gap:8px; flex-wrap:wrap; margin:16px 0`), `.subscribe label` inline, `.subscribe input` (font inherit, `8px 11px`, `--line` border, radius 8, `min-width:240px`, focus ring), `.subscribe__status` (`.82rem`, `--muted`).
- [ ] In `Subscribe.astro`, add `class="btn"` to the `<button type="submit">`.
- [ ] Verify: `npm run build` succeeds.

### Task 2: Scorecard — semantic color, interactive prop, resting cue
**Files:** Modify `src/components/SummaryStats.astro`; `src/pages/labs/[lab].astro`; `src/styles/global.css`.
- [ ] In `global.css` add `.stat--upcoming .stat__n{color:var(--upcoming)}`, `--missed`, `--met`, `--partial`, `--pending` equivalents (overdue already done). Add `.summary-hint{font-size:.75rem;color:var(--muted);margin:-8px 0 16px;text-align:right}`.
- [ ] In `SummaryStats.astro` add `interactive` prop (default `true`). When `interactive`, keep `role="button" tabindex="0" data-filter-status aria-label` as today; when not, render `<div class={`stat stat--${key}`} data-stat={key}>` only. After the `.summary` div, when `interactive`, render `<p class="summary-hint" aria-hidden="true">Tap a metric to filter the board ↓</p>` (wrap output in a Fragment).
- [ ] In `labs/[lab].astro` change to `<SummaryStats counts={counts} interactive={false} />`.
- [ ] Verify: `npm run build`; lab scorecard renders without `role="button"`, homepage shows the hint and colored numbers.

### Task 3: Explore table discoverability
**Files:** Modify `src/pages/table.astro` (scoped `<style>`); the Reset button.
- [ ] In the existing `<style>` block add: `.th-sort::after{content:" \2195";opacity:.35;font-weight:400}` (default sort hint), keep the existing `th[aria-sort="ascending"] .th-sort::after{content:" \25B2"}` / `descending → \25BC` (these override). Add `#ctable tbody tr:hover{background:#fafafb}`. Add `#ctable td:nth-child(4),#ctable td:nth-child(5),#ctable th:nth-child(4),#ctable th:nth-child(5){white-space:nowrap}` (Committed/Deadline) and `#ctable td:nth-child(2){min-width:240px}` (Commitment).
- [ ] Change Reset button to `class="btn btn--ghost"`.
- [ ] Verify: `npm run build`; headers show ⇅, active sort shows ▲/▼, rows highlight on hover.

### Task 4: Detail page — ruling casing, copy citation, footer nav
**Files:** Modify `src/pages/c/[id].astro`; create `src/scripts/cite.ts`; `src/styles/global.css`.
- [ ] In `[id].astro` stages array, change the Ruling label to title-case: `label: c.resolution ? c.resolution[0].toUpperCase() + c.resolution.slice(1) : '—'`.
- [ ] Wrap the citation in a flex header with a Copy button:
  ```astro
  <div class="cite">
    <div class="cite__head"><span>Cite this commitment</span>
      <button type="button" class="btn btn--ghost cite__copy" data-cite-copy>Copy</button></div>
    <code data-cite-text>{cite}</code>
  </div>
  ```
  (Remove the now-duplicate `<h2>Cite this commitment</h2>` if folding the label into the box, or keep the `<h2>` and just add the button row — keep the `<h2>`, add a button row inside `.cite`.)
- [ ] Create `src/scripts/cite.ts` (DOM-only, guarded `if (typeof document !== 'undefined')`): on click of `[data-cite-copy]`, `navigator.clipboard.writeText` the `[data-cite-text]` textContent, set button text to "Copied" for ~1.5s.
- [ ] Add `<script>import '../../scripts/cite.ts';</script>` before `</body>`.
- [ ] Add footer nav `<p>` to the detail footer: Board · Table · Methodology · Updates · Corrections · JSON · CSV (base-aware via `withBase`).
- [ ] Add `.cite__head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}` and `.cite__copy{font-size:.78rem;padding:4px 12px}` to `global.css`.
- [ ] Verify: `npm run build`; clicking Copy works in the browser.

### Task 5: Lab page footer nav
**Files:** Modify `src/pages/labs/[lab].astro`.
- [ ] Add the same compact footer nav `<p>` (Board · Table · Methodology · Updates · Corrections · JSON · CSV) to the lab footer.
- [ ] Verify: `npm run build`.

### Task 6: Favicon
**Files:** Create `public/favicon.svg`; modify the `<head>` of all 8 pages (`index`, `table`, `updates`, `corrections`, `methodology`, `c/[id]`, `labs/[lab]`) — note `commitments.*.ts`/`feed.xml.ts`/`*.json.ts` have no head.
- [ ] Create `public/favicon.svg` (red clock mark, `viewBox 0 0 32 32`).
- [ ] In each page `<head>` (after the viewport meta) add `<link rel="icon" type="image/svg+xml" href={`${import.meta.env.BASE_URL}favicon.svg`} />`.
- [ ] Verify: `npm run build` copies `favicon.svg` to `dist/`; the `<link>` appears in built HTML.

### Task 7: Contested de-emphasis
**Files:** Modify `src/styles/global.css`.
- [ ] Change `.contested` color from `var(--partial)` to `var(--muted)`.
- [ ] Verify: `npm run build`.

### Task 8: Full verification
- [ ] `npm test` (52 vitest) green — regression guard.
- [ ] `pytest server/subscribe -q` (40) green — unaffected, confirm.
- [ ] `npm run build` and `PAGES=1 npm run build` both green.
- [ ] Browser re-check (extension Playwright): home (desktop+mobile), table, a `/c/` page (Copy works), a `/labs/` page (no dead scorecard buttons). Screenshot before/after where useful.
- [ ] Fix any regression surfaced.

### Task 9: Changelog + ship  *(do not skip — bind to this plan)*
- [ ] Add a `## 2026-06-19 · UI/UX polish` entry to `CHANGELOG.md` (match existing format; newest first, above the review-remediation entry).
- [ ] Commit by explicit paths, `--author="kayadibi1 <sidarvig@gmail.com>"`, CHANGELOG in the **same** commit.
- [ ] `git push origin main` (auto-deploys) and watch the run green.
- [ ] Verify the changes on the live site (subscribe styling, scorecard color, favicon, copy button).
