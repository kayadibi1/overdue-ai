# Milestone 6 — Depth & credibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Checkbox (`- [ ]`) steps. TDD the pure helpers; build-verify the Astro pages.

**Goal:** Per-lab pages, per-commitment detail pages (with a status timeline + surfaced `notes`), a trust layer (source + last-verified + cite + CC BY + CSV), an explore table, and a corrections page — reusing the existing data model + `status.ts` helpers.

**Architecture:** New pure helpers in `src/lib/` (TDD, vitest). New Astro static pages via `getStaticPaths`. Two optional data fields. CC BY 4.0 for the dataset. No backend.

**Spec:** `docs/superpowers/specs/2026-06-19-m6-depth-credibility-design.md`

---

### Task 1: Data-model fields + integrity tests

**Files:** Modify `src/lib/types.ts`, `src/lib/site.ts`; Modify `tests/data.test.ts`

- [ ] **Step 1:** In `types.ts`, add to `Commitment`: `lastChecked?: string;  // 'YYYY-MM-DD', when this row's status was last re-verified`. Add to `Update`... (Update is in `src/data/updates.ts`) — add `kind?: 'update' | 'correction';`.
- [ ] **Step 2:** In `site.ts` add `export const DATA_AS_OF = '2026-06-19'; // dataset last reviewed (manually bumped); per-row lastChecked overrides`.
- [ ] **Step 3:** Append integrity tests to `tests/data.test.ts`: every `lastChecked` (where present) matches `/^\d{4}-\d{2}-\d{2}$/` and is a real UTC date; every `UPDATES` `kind` (where present) ∈ `{update, correction}`.
- [ ] **Step 4:** `npm test` green. Commit `feat(m6): lastChecked + Update.kind fields + DATA_AS_OF + integrity tests`.

---

### Task 2: `src/lib/labs.ts` — slug + grouping + kept-rate (TDD)

**Files:** Create `src/lib/labs.ts`, `tests/m6.test.ts`

- [ ] **Step 1: Failing tests** (`tests/m6.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { labSlug, labFromSlug, keptRate } from '../src/lib/labs';
import type { Commitment } from '../src/lib/types';

const c = (o: Partial<Commitment>): Commitment => ({
  id:'x', lab:'OpenAI', track:'lab', title:'t', description:'d', category:'governance',
  committedOn:'2025-01-01', deadlineType:'calendar', deadline:'2025-06-01',
  resolution:null, resolvedOn:null, evidenceUrl:'https://e', sourceLabel:'S', ...o });

describe('labSlug', () => {
  it('lowercases + hyphenates, round-trips', () => {
    expect(labSlug('Google DeepMind')).toBe('google-deepmind');
    expect(labSlug('Multi-lab')).toBe('multi-lab');
    expect(labFromSlug('google-deepmind')).toBe('Google DeepMind');
    expect(labFromSlug('nope')).toBeNull();
  });
});

describe('keptRate', () => {
  it('met / resolved among resolved only; null when none resolved', () => {
    const rows = [c({resolution:'met'}), c({resolution:'missed'}), c({resolution:'partial'}), c({resolution:null})];
    const r = keptRate(rows);
    expect(r.met).toBe(1); expect(r.resolved).toBe(3); expect(r.rate).toBeCloseTo(1/3);
    expect(keptRate([c({resolution:null})]).rate).toBeNull();
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement:

```ts
import type { Commitment, Lab } from './types';
import { LABS } from './types';

export function labSlug(lab: string): string { return lab.toLowerCase().replace(/\s+/g, '-'); }
export function labFromSlug(slug: string): Lab | null { return LABS.find((l) => labSlug(l) === slug) ?? null; }

/** Lab-track commitments grouped by lab, only labs that have any. */
export function commitmentsByLab(commitments: Commitment[]): Map<Lab, Commitment[]> {
  const m = new Map<Lab, Commitment[]>();
  for (const c of commitments) {
    if (c.track !== 'lab') continue;
    if (!m.has(c.lab)) m.set(c.lab, []);
    m.get(c.lab)!.push(c);
  }
  return m;
}

/** Kept-rate among RESOLVED commitments: met / (met+missed+partial). null if none resolved. */
export function keptRate(list: Commitment[]): { met: number; resolved: number; rate: number | null } {
  const resolved = list.filter((c) => c.resolution !== null);
  const met = resolved.filter((c) => c.resolution === 'met').length;
  return { met, resolved: resolved.length, rate: resolved.length ? met / resolved.length : null };
}
```

- [ ] **Step 4:** Run → PASS. Commit `feat(m6): labs helpers (slug/group/keptRate) + tests`.

---

### Task 3: `src/lib/csv.ts` — RFC 4180 serializer (TDD)

**Files:** Create `src/lib/csv.ts`; Modify `tests/m6.test.ts`

- [ ] **Step 1: Failing test** (append)

```ts
import { toCsv } from '../src/lib/csv';
describe('toCsv', () => {
  it('emits a header + escapes commas/quotes/newlines (RFC 4180)', () => {
    const out = toCsv([c({ id:'a', title:'has, comma "q"\nnl', resolution:'met' })]);
    const [header, row] = out.trim().split('\r\n');
    expect(header.startsWith('id,lab,track,title,')).toBe(true);
    expect(row).toContain('"has, comma ""q""\nnl"');
    expect(out.endsWith('\r\n')).toBe(true);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement:

```ts
import type { Commitment } from './types';
const COLS = ['id','lab','track','title','category','committedOn','deadlineType','deadline','triggerText','resolution','resolvedOn','evidenceUrl','sourceLabel','contested','lastChecked'] as const;
function esc(v: unknown): string { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
export function toCsv(rows: Commitment[]): string {
  const lines = [COLS.join(','), ...rows.map((c) => COLS.map((k) => esc((c as Record<string, unknown>)[k])).join(','))];
  return lines.join('\r\n') + '\r\n';
}
```

- [ ] **Step 4:** Run → PASS. Commit `feat(m6): RFC4180 CSV serializer + test`.

---

### Task 4: `/commitments.csv` endpoint

**Files:** Create `src/pages/commitments.csv.ts`

- [ ] **Step 1:** (mirror `commitments.json.ts`)

```ts
import type { APIRoute } from 'astro';
import { COMMITMENTS } from '../data/commitments';
import { toCsv } from '../lib/csv';
export const prerender = true;
export const GET: APIRoute = () => new Response(toCsv(COMMITMENTS), {
  headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="overdue-commitments.csv"' },
});
```

- [ ] **Step 2:** `npm run build` → `dist/commitments.csv` exists; `head -1 dist/commitments.csv` is the header. Commit `feat(m6): /commitments.csv export`.

---

### Task 5: `CommitmentCard` — links, provenance, as-of

**Files:** Modify `src/components/CommitmentCard.astro`

- [ ] **Step 1:** Read the current card. Add imports `labSlug` (from `../lib/labs`), `DATA_AS_OF` (from `../lib/site`), and an inline `const withBase = (p: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;` (the same helper the pages use). Changes:
  - Wrap the title in a link to `withBase(\`/c/${c.id}\`)`.
  - Make the lab badge a link to `withBase(\`/labs/${labSlug(c.lab)}\`)`.
  - After the footer, add `{c.notes && <details class="card__why"><summary>Why this ruling</summary><p>{c.notes}</p></details>}`.
  - Add a small `<span class="card__asof">as of {c.lastChecked ?? DATA_AS_OF}</span>` near the source.
- [ ] **Step 2:** `npm run build` green; homepage cards show the title link + "Why this ruling" on rows with notes. Commit `feat(m6): card links to /c + /labs, surfaced notes, as-of`.

---

### Task 6: `/c/[id]` per-commitment pages + timeline

**Files:** Create `src/pages/c/[id].astro`

- [ ] **Step 1:** `getStaticPaths` over all `COMMITMENTS` (`params: { id }`, `props: { c }`). Render (reuse page chrome from `methodology.astro`): title, `StatusChip` (computeStatus), description, the **timeline rail** — a `<ol class="timeline">` with stages `Committed {committedOn}` · `Due {deadline ?? triggerText ?? '—'}` · `Evaluated {resolvedOn ?? '—'}` · `Ruling {resolution ?? '—'}`, each `<li>` gets `data-done={!!value}` (CSS ghosts undone). The `notes` provenance ("Why this ruling"), `contested` flag, Source (`evidenceUrl`/`sourceLabel`), `committedOn`, "as of {lastChecked ?? DATA_AS_OF}". Any `UPDATES` with `commitmentIds?.includes(id)` newest-first. A "Cite this commitment" line (`<author>. "<title>." Overdue, <year>. https://overduetracker.org/c/<id> (retrieved <date>)`). Canonical `<link rel="canonical" href={`${CANONICAL_ORIGIN}/c/${id}`}>`.
- [ ] **Step 2:** `npm run build` → `dist/c/<id>/index.html` for all 29; spot-check one. Commit `feat(m6): /c/[id] per-commitment pages with timeline + cite`.

---

### Task 7: `/labs/[lab]` per-lab report-card pages

**Files:** Create `src/pages/labs/[lab].astro`

- [ ] **Step 1:** `getStaticPaths` over `commitmentsByLab(COMMITMENTS).keys()` (`params: { lab: labSlug(lab) }`, `props: { lab, rows }`). Render: `<h1>{lab}</h1>`, `SummaryStats counts={summarize(rows, now)}`, a kept-rate line `const k = keptRate(rows)` → `{k.rate==null ? 'No resolved commitments yet' : \`${Math.round(k.rate*100)}% kept (${k.met}/${k.resolved} resolved)\`}` with a one-line "kept = met ÷ resolved" note, then `sortByUrgency(rows, now).map(c => <CommitmentCard c={c} now={now} />)`. Canonical to `/labs/<slug>`. Link back to the board.
- [ ] **Step 2:** `npm run build` → a page per non-empty lab; spot-check. Commit `feat(m6): /labs/[lab] report-card pages`.

---

### Task 8: `/table` explore view + island

**Files:** Create `src/pages/table.astro`, `src/scripts/table.ts`

- [ ] **Step 1:** `table.astro`: a `<table id="ctable">` with a `<thead>` of sortable headers (`<th data-sort="lab|title|category|committed|deadline|status">`) and a `<tbody>` of rows (one `<tr data-lab data-status data-committed data-deadline>` per `sortByUrgency(COMMITMENTS, now)`), columns Lab (link `/labs/<slug>`) · Commitment (link `/c/<id>`) · Category · Committed · Deadline · Status (`StatusChip`) · Source. Add lab + status `<select>` filters + a text `<input id="ctable-q">` + reset, mirroring the board controls. `<script>import '../scripts/table.ts'</script>`.
- [ ] **Step 2:** `table.ts` (guarded `if (typeof document!=='undefined')` for node-test safety; mirror `board.ts`): header click → sort the tbody rows by that column (toggle asc/desc); the selects + text input → filter rows (`tr.hidden`); reset clears. No new pure logic needed (DOM-only).
- [ ] **Step 3:** `npm run build` green; `dist/table/index.html` has the table + controls. Commit `feat(m6): /table explore view (sortable/filterable island)`.

---

### Task 9: `/corrections` page

**Files:** Create `src/pages/corrections.astro`

- [ ] **Step 1:** Filter `UPDATES` to `kind === 'correction'`, `sortUpdates` newest-first. Render each (date, title, body, links to `commitmentIds` → `/c/<id>`). Header: "When we change a ruling or fix an error, it's logged here." Empty-state copy when none. Canonical `/corrections`.
- [ ] **Step 2:** `npm run build` green. Commit `feat(m6): /corrections transparency page`.

---

### Task 10: Trust content + nav + clickable scorecard + data license

**Files:** Create `LICENSE-DATA`; Modify `src/pages/methodology.astro`, `src/pages/index.astro`

- [ ] **Step 1:** `LICENSE-DATA` = the full **CC BY 4.0** legal text (or the standard short notice + the canonical URL `https://creativecommons.org/licenses/by/4.0/`), headed "Overdue dataset (src/data/*, /commitments.json, /commitments.csv) is licensed CC BY 4.0. Code is MIT (see LICENSE)."
- [ ] **Step 2:** `methodology.astro`: add a **"Data, license & how to cite"** section — state CC BY 4.0 + "republish freely with attribution"; a pre-written citation string; **Download: [JSON](/commitments.json) · [CSV](/commitments.csv)**; links to `/corrections` and `/table`.
- [ ] **Step 3:** `index.astro` + `SummaryStats.astro` + `src/scripts/board.ts`: make the scorecard counts **clickable filters of the on-page board**. In `SummaryStats.astro` add `data-filter-status={key}`, `role="button"`, `tabindex="0"` to each stat. In `board.ts` add a click (and Enter-key) handler on `[data-filter-status]` that sets `#filter-status.value` to that key, calls `applyControls()`, and scrolls to `#board`. Also in `index.astro`: a "**View as table**" link near the board controls, a "**Browse by lab:** OpenAI · Anthropic · …" line (each → `withBase('/labs/'+labSlug(lab))`), and **Download (JSON · CSV)** + **Corrections** links in the footer.
- [ ] **Step 4:** `npm run build` green; methodology shows license+cite+downloads; homepage shows table/lab links + clickable stats. Commit `feat(m6): CC BY data license + how-to-cite + downloads + nav (table/labs/corrections)`.

---

### Task 11: README + CHANGELOG (same wave — the binding fix)

**Files:** Modify `README.md`, `CHANGELOG.md`

- [ ] **Step 1:** README: note per-lab + per-commitment pages, the table, CSV, and **CC BY 4.0** data license (code MIT).
- [ ] **Step 2:** CHANGELOG `## 2026-06-19 · M6 — depth & credibility`: per-lab report-card pages; per-commitment pages with a status timeline + surfaced provenance (`notes`); trust layer (source + as-of + how-to-cite + **CC BY 4.0** + CSV export); explore table; corrections page; clickable scorecard. Borrowed from CAT/PolitiFact/Net Zero/OWID/GovTrack.
- [ ] **Step 3:** Full: `npm test` + `npm run build` + `PAGES=1 npm run build` all green. Commit `docs(m6): README + CHANGELOG`.

---

## Self-Review checklist (run before building)
- Coverage: fields ✅(T1) · labs ✅(T2,T7) · csv ✅(T3,T4) · card ✅(T5) · /c ✅(T6) · /table ✅(T8) · /corrections ✅(T9) · trust/license/nav ✅(T10) · changelog ✅(T11).
- Reuse: `summarize`/`sortByUrgency`/`computeStatus`/`StatusChip`/`CommitmentCard` reused, not reimplemented. `notes` surfaced (no new provenance field).
- Base-path: all internal links use `withBase()`; canonicals use `CANONICAL_ORIGIN`.
- Node-test safety: `table.ts` DOM code guarded by `typeof document !== 'undefined'`.
- Determinism: pages render from data at build; no `Date.now()` divergence (timers reuse `liveLabel`).
