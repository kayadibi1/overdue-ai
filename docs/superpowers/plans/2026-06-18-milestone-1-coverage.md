# Overdue — Milestone 1 (Credible Reference) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Overdue's data into a credible reference: a sharper "promises the labs made" identity, ~24–28 well-sourced lab commitments (≥22 floor, quality-gated), and EU/regulatory items shown as countdown-only context beneath the board.

**Architecture:** Add a `track: 'lab' | 'regulatory'` field; the page partitions rows by track and renders the scored lab board plus a lighter "Upcoming regulatory milestones" section beneath. A new pure `regulatoryLabel()` drives the (never-"overdue") regulatory countdowns. The bulk of the work is rigorous, web-verified data curation.

**Tech Stack:** Astro 5 (static), TypeScript, vitest.

Spec: `docs/superpowers/specs/2026-06-18-milestone-1-coverage-design.md`. Project root: `~/Desktop/overdue-ai`.

---

## File map

| File | Change |
|---|---|
| `src/lib/types.ts` | add `Track` type + `track` field to `Commitment` |
| `src/lib/status.ts` | add pure `regulatoryLabel(deadline, now)` (countdown-only, never "overdue") |
| `tests/status.test.ts` | tests for `regulatoryLabel` |
| `src/data/commitments.ts` | add `track` to every row, reclassify EU → `regulatory`, grow `lab` to ~24–28 (≥22 floor, ≥3 live), all web-verified |
| `tests/data.test.ts` | enforce: valid `track`, ≥22 lab rows, ≥3 live lab rows, regulatory rows dated + no `resolution`, lab/regulatory split |
| `src/components/RegulatoryItem.astro` | new lighter card for a regulatory milestone |
| `src/pages/index.astro` | partition by `track`; summary/sort over `lab` only; render regulatory section beneath |
| `src/scripts/board.ts` | tick regulatory countdowns too (via `regulatoryLabel`) |
| `src/pages/methodology.astro` | add "Inclusion criteria" + "Related trackers" sections; identity copy |
| `src/pages/index.astro` (header), `README.md` | identity/tagline → "promises they made" |

---

## Task 1: `track` field + `regulatoryLabel` helper

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/status.ts`
- Test: `tests/status.test.ts`

- [ ] **Step 1: Add the `Track` type + field to `src/lib/types.ts`**

Add near the top (after `Category`/`CATEGORIES`):

```ts
export type Track = 'lab' | 'regulatory';
```

Add this line inside the `Commitment` interface (right after `lab: Lab;`):

```ts
  track: Track;               // 'lab' = a promise the lab made (scored); 'regulatory' = a law/milestone (context, countdown-only)
```

- [ ] **Step 1b: Backfill `track: 'lab'` everywhere the now-required field is needed**

Because `track` is required, add `track: 'lab',` to **every** existing object in `src/data/commitments.ts` (all 25 rows — the EU rows get *reclassified* to `regulatory` in Task 3, not now) and to the `make()` fixture in `tests/status.test.ts`. This keeps `tsc` / `astro check` green from here on (no broken-type window before Task 3).

- [ ] **Step 2: Write the failing test** — append to `tests/status.test.ts`

```ts
import { regulatoryLabel } from '../src/lib/status';

describe('regulatoryLabel', () => {
  const NOW2 = Date.UTC(2026, 5, 18); // 2026-06-18
  it('counts down to a future statutory date (upcoming, never overdue)', () => {
    expect(regulatoryLabel('2026-08-02', NOW2)).toEqual({ label: 'in 45 days', kind: 'upcoming', days: 45 });
  });
  it('shows "in force since" once the date has passed (never "overdue")', () => {
    const r = regulatoryLabel('2025-08-02', NOW2);
    expect(r.kind).toBe('inforce');
    expect(r.label).toBe('in force since 2025-08-02');
  });
});
```

- [ ] **Step 3: Run — verify it fails**

Run: `npm test -- status`
Expected: FAIL ("regulatoryLabel is not a function").

- [ ] **Step 4: Implement `regulatoryLabel` — append to `src/lib/status.ts`**

```ts
/**
 * Label for a regulatory milestone (a date a law applies). Countdown-only:
 * before the date it is `upcoming`; after, it is `inforce` ("in force since
 * <date>") — a law is never "overdue" or "missed". Independent of computeStatus.
 */
export function regulatoryLabel(deadline: string, now: number): { label: string; kind: 'upcoming' | 'inforce'; days: number } {
  const ms = parseUTC(deadline);
  if (ms > now) {
    const days = Math.ceil((ms - now) / DAY_MS);
    return { label: `in ${plural(days, 'day')}`, kind: 'upcoming', days };
  }
  const days = Math.floor((now - ms) / DAY_MS);
  return { label: `in force since ${deadline}`, kind: 'inforce', days };
}
```

> `plural` and `parseUTC` and `DAY_MS` already exist in `status.ts` (function declarations are hoisted, so order is fine).

- [ ] **Step 5: Run — verify pass**

Run: `npm test -- status`
Expected: PASS (15 tests: the prior 13 + 2 new).

- [ ] **Step 6: Commit**

```bash
git -C ~/Desktop/overdue-ai add src/lib/types.ts src/lib/status.ts src/data/commitments.ts tests/status.test.ts
git -C ~/Desktop/overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "feat: track field (backfilled 'lab') + regulatoryLabel"
```

---

## Task 2: Update the data-integrity tests (test-first)

**Files:**
- Modify: `tests/data.test.ts`

> These assertions will FAIL against the current data (rows lack `track`, and there are fewer than 30 lab rows) — that's intended; Task 3 makes them pass.

- [ ] **Step 1: Replace the body of `tests/data.test.ts` with**

```ts
import { describe, it, expect } from 'vitest';
import { COMMITMENTS } from '../src/data/commitments';
import { LABS, CATEGORIES } from '../src/lib/types';
import { computeStatus } from '../src/lib/status';

const NOW = Date.UTC(2026, 5, 18);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TRACKS = ['lab', 'regulatory'];

const lab = () => COMMITMENTS.filter((c) => c.track === 'lab');
const regulatory = () => COMMITMENTS.filter((c) => c.track === 'regulatory');

describe('COMMITMENTS dataset', () => {
  it('every row passes schema rules', () => {
    for (const c of COMMITMENTS) {
      expect(c.id, c.id).toBeTruthy();
      expect(TRACKS, c.id).toContain(c.track);
      expect(LABS, c.id).toContain(c.lab);
      expect(CATEGORIES, c.id).toContain(c.category);
      expect(c.title && c.description).toBeTruthy();
      expect(ISO.test(c.committedOn)).toBe(true);
      if (c.deadlineType === 'calendar') expect(ISO.test(c.deadline ?? '')).toBe(true);
      if (c.deadlineType === 'trigger') expect(c.triggerText).toBeTruthy();
      if (c.resolution) expect(ISO.test(c.resolvedOn ?? '')).toBe(true);
      expect(() => new URL(c.evidenceUrl)).not.toThrow();
      expect(c.sourceLabel).toBeTruthy();
    }
  });
  it('has unique ids', () => {
    const ids = COMMITMENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('has >= 22 lab-track rows', () => {
    expect(lab().length).toBeGreaterThanOrEqual(22);
  });
  it('has >= 3 LIVE lab-track rows (overdue or upcoming)', () => {
    const live = lab().filter((c) => ['overdue', 'upcoming'].includes(computeStatus(c, NOW)));
    expect(live.length).toBeGreaterThanOrEqual(3);
  });
  it('regulatory rows are dated and unscored (no kept/broken resolution)', () => {
    for (const c of regulatory()) {
      expect(c.deadlineType, c.id).toBe('calendar');
      expect(ISO.test(c.deadline ?? ''), c.id).toBe(true);
      expect(c.resolution, c.id).toBeNull();
    }
  });
  it('contains both tracks (the partition is real)', () => {
    expect(lab().length).toBeGreaterThan(0);
    expect(regulatory().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npm test -- data`
Expected: FAIL — the **"contains both tracks"** assertion fails (after Task 1 every row is `track: 'lab'`, so there are no `regulatory` rows until Task 3 reclassifies the EU rows). Track-validity and the ≥22-lab check already pass.

- [ ] **Step 3: Commit the failing test**

```bash
git -C ~/Desktop/overdue-ai add tests/data.test.ts
git -C ~/Desktop/overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "test: M1 data-integrity rules (track, >=30 lab, >=3 live, regulatory unscored)"
```

---

## Task 3: Curate the dataset (web-verified)

**Files:**
- Modify: `src/data/commitments.ts`

This is the milestone's substance. **Use web search to verify every row** (date, outcome, that `evidenceUrl` resolves and is on-topic) at the bar that caught the false xAI claim in the base build.

**Rules (from spec §5):**
- A `lab` row is a **specific, dated, public promise the lab itself made or signed** (RSP/FSF/Preparedness milestones, self-imposed deadlines, Seoul/White House pledges, AISI MOUs the lab entered). One rock-solid source, primary preferred; **"missed" rulings need a primary/major-press source, never a lone wiki**. Neutral phrasing, no editorializing verbs. Debatable → `contested: true`.
- A `regulatory` row is a **statutory date** (EU AI Act). `track: 'regulatory'`, `deadlineType: 'calendar'`, `resolution: null` (unscored), neutral description. When a row is genuinely ambiguous lab-vs-regulatory, default to `regulatory`.
- Any **recurring "next X due ~DATE"** derived from a cadence (not a lab-stated date) → `contested: true` with the derivation in `notes`.

- [ ] **Step 1: Reclassify the EU rows to `regulatory` (the `lab` backfill was done in Task 1)**
Change `track: 'lab'` → **`track: 'regulatory'`** on the EU statutory rows — the `eu-aia-*` rows **and** `eu-gpai-cop-finalized` (the EU GPAI Code is a regulatory instrument) — and set their **`resolution: null`** (strip any scoring; keep `deadlineType: 'calendar'` + `deadline`). Lab–government commitments the labs *entered* (`nist-aisi-mou-2024`, `uk-aisi-predeployment`, `wh-voluntary-redteam-2023`) stay `track: 'lab'`. Also add **`contested: true`** to the two cadence-derived live rows `anthropic-risk-report-next` and `anthropic-annual-procedural-review` (their next-dates are derived from a cadence, not lab-stated — spec §5 rule 7).

- [ ] **Step 2: Grow `lab`-track rows to ≥22, target ~24–28 (quality-gated — do NOT pad)**
Reality check: after reclassification there are ~19 `lab` rows, and genuine *dated promises* (vs. mere version-publication events, which are not promises and don't qualify) are limited — the honest ceiling is ~24–28, not 30+. Add only rows that are real dated promises a lab made or signed; if you cannot reach a number without stretching, stop and report the honest count rather than padding.
Add new web-verified lab commitments. Pull candidates from the base plan's "Sourced candidate appendix" (`docs/superpowers/plans/2026-06-18-overdue.md`) AND each lab's primary pages:
- Anthropic RSP/ASL version history + named milestones (`anthropic.com/rsp-updates`), Risk Report cadence, third-party review, LTBT, sabotage-report commitment.
- OpenAI Preparedness Framework versions + the annual-review cadence, Superalignment compute pledge, Safety & Security Committee 90-day deliverable.
- Google DeepMind Frontier Safety Framework versions + "implemented by early 2025" + eval cadence.
- Meta Frontier AI Framework (Seoul), Microsoft Frontier Governance Framework.
- xAI draft → updated RMF.
- Cross-lab signed pledges: Seoul "publish a framework by Paris", White House July-2023 voluntary commitments, US/UK AISI access MOUs, Bletchley pre-deployment testing.
Each row in the `Commitment` shape (see `src/lib/types.ts`), `track: 'lab'`, web-verified, neutral, `contested` where debatable.

- [ ] **Step 3: Ensure ≥3 LIVE lab rows (honestly)**
Keep genuinely live `lab` items: OpenAI Preparedness annual-review (overdue, `contested`, derived — already present), Anthropic Risk Report cadence (upcoming), Anthropic annual third-party review (upcoming). Do **not** invent dates to pad liveness; ≥3 is the floor and these already exist.

- [ ] **Step 4: Run — verify the data tests pass**

Run: `npm test`
Expected: PASS — `data.test.ts` green (≥22 lab, ≥3 live, both tracks, regulatory unscored), `status.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git -C ~/Desktop/overdue-ai add src/data/commitments.ts
git -C ~/Desktop/overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "feat: M1 coverage — reclassify EU as regulatory, grow lab promises to ~24-28 (web-verified)"
```

---

## Task 4: Partition the page + regulatory section

**Files:**
- Create: `src/components/RegulatoryItem.astro`
- Modify: `src/pages/index.astro`, `src/scripts/board.ts`

- [ ] **Step 1: Create `src/components/RegulatoryItem.astro`**

```astro
---
import type { Commitment } from '../lib/types';
import { regulatoryLabel } from '../lib/status';
interface Props { c: Commitment; now: number }
const { c, now } = Astro.props;
const rel = regulatoryLabel(c.deadline as string, now);
---
<article class="reg" data-reg data-deadline={c.deadline}>
  <div class="reg__head"><span class="badge">{c.lab}</span><span class="tag">{c.category}</span></div>
  <h4 class="reg__title">{c.title}</h4>
  <p class="reg__desc">{c.description}</p>
  <div class="reg__timer" data-reg-timer data-deadline={c.deadline}>{rel.label}</div>
  <a class="reg__src" href={c.evidenceUrl} target="_blank" rel="noopener noreferrer">Source: {c.sourceLabel} ↗</a>
</article>
<style>
  .reg { background: #fbfbfd; border: 1px dashed var(--line); border-radius: 8px; padding: 12px 14px; }
  .reg__head { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
  .reg__title { margin: 2px 0; font-size: .92rem; }
  .reg__desc { margin: 0 0 6px; color: var(--muted); font-size: .85rem; }
  .reg__timer { font-family: var(--mono); font-size: .95rem; color: var(--upcoming); font-weight: 700; }
  .reg__src { font-size: .78rem; }
</style>
```

- [ ] **Step 2: Partition rows + render the regulatory section in `src/pages/index.astro`**

In the frontmatter, replace the single-list setup so the board uses the `lab` track and a new `regulatory` list is prepared:

```ts
import RegulatoryItem from '../components/RegulatoryItem.astro';
// ... existing imports ...
const now = Date.now();
const labRows = COMMITMENTS.filter((c) => c.track === 'lab');
const regulatoryRows = COMMITMENTS.filter((c) => c.track === 'regulatory' && c.deadlineType === 'calendar' && c.deadline != null)
  .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
const sorted = sortByUrgency(labRows, now);   // board = lab only
const counts = summarize(labRows, now);        // headline = lab only
```

(The `labs` filter for the Lab dropdown should derive from `labRows`, not all `COMMITMENTS`.)

After the existing lab `<section id="board">…</section>` and its `#empty` paragraph, insert:

```astro
    <section class="reg-section" aria-label="Upcoming regulatory milestones">
      <h2>Upcoming regulatory milestones</h2>
      <p class="reg-note">Context, not scored. These are <strong>laws</strong> (e.g. the EU AI Act), not promises a lab made — shown as countdowns, never marked "missed".</p>
      <div class="reg-grid">
        {regulatoryRows.map((c) => <RegulatoryItem c={c} now={now} />)}
      </div>
    </section>
```

- [ ] **Step 3: Add styles for the regulatory section** — append to `src/styles/global.css`

```css
.reg-section { margin-top: 36px; padding-top: 18px; border-top: 2px solid var(--line); }
.reg-section h2 { font-size: 1.1rem; margin: 0 0 4px; }
.reg-note { margin: 0 0 14px; color: var(--muted); font-size: .85rem; }
.reg-grid { display: grid; gap: 10px; }
```

- [ ] **Step 4: Tick regulatory countdowns in `src/scripts/board.ts`**

Add `regulatoryLabel` to the import and, at the end of `tick()` (before it closes), update regulatory timers too:

```ts
// add to the import line:
import { liveLabel, regulatoryLabel } from '../lib/status';

// inside tick(), after the .card loop and before updating the overdue stat:
  document.querySelectorAll<HTMLElement>('[data-reg-timer]').forEach((el) => {
    const d = el.dataset.deadline;
    if (d) el.textContent = regulatoryLabel(d, now).label;
  });
```

- [ ] **Step 5: Build + manual check**

Run: `npm run build && npm run preview`
Expected: lab board renders (counts exclude regulatory); a "Upcoming regulatory milestones" section appears beneath with EU items counting down; no "overdue" on regulatory items.

- [ ] **Step 6: Commit**

```bash
git -C ~/Desktop/overdue-ai add src/components/RegulatoryItem.astro src/pages/index.astro src/scripts/board.ts src/styles/global.css
git -C ~/Desktop/overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "feat: partition board by track + regulatory milestones section"
```

---

## Task 5: Methodology + identity copy

**Files:**
- Modify: `src/pages/methodology.astro`, `src/pages/index.astro`, `README.md`

- [ ] **Step 1: Update the methodology (don't duplicate — it already has these sections)**

`src/pages/methodology.astro` already has a **"What counts"** `<h2>` and a **"Relationship to prior work"** `<h2>` (plus "How rulings are made", "Editorial principles", "Open data & corrections" — leave those). *Update the two in place:*

1. Replace the **"What counts"** section (its `<h2>` + body) with the fuller inclusion criteria, including the lab-vs-regulatory split:

```astro
      <h2>What we include (and what we don't)</h2>
      <ul>
        <li>A <strong>specific, dated</strong> public promise — a calendar deadline or a falsifiable trigger. Vague or aspirational pledges are excluded.</li>
        <li>For the main board, a promise <strong>the lab itself made or signed</strong> (RSP/Preparedness/Frontier-Safety milestones, self-imposed deadlines, the Seoul and White House voluntary commitments). Government <strong>laws</strong> (e.g. the EU AI Act) are not promises a lab made — they appear separately as <em>regulatory milestones</em>, as countdowns, never scored kept or broken.</li>
        <li>One <strong>rock-solid public source</strong> per row (primary preferred); a "missed" ruling requires especially strong sourcing.</li>
        <li>Neutral, factual phrasing; genuinely debatable rulings are flagged <code>⚠ contested</code>.</li>
      </ul>
```

2. Rename/replace the **"Relationship to prior work"** section as **"Related trackers"** with this body (fold in whatever it already says — don't keep both):

```astro
      <h2>Related trackers</h2>
      <p>Overdue complements existing work rather than replacing it. <a href="https://www.seoul-tracker.org/">The Midas Project's Seoul Tracker</a> grades one collective deadline; <a href="https://metr.org/fsp">METR's index</a> catalogs policy <em>documents</em>; <a href="https://ailabwatch.org/">AI Lab Watch</a>, the <a href="https://futureoflife.org/">FLI AI Safety Index</a>, and <a href="https://www.safer-ai.org/">SaferAI</a> grade overall posture. Overdue's contribution is breadth and a live per-promise counter: many individual dated commitments, each with a status and one source.</p>
```

- [ ] **Step 2: Update the identity copy**

In `src/pages/index.astro`, change the tagline to the "promises they made" framing:

```astro
      <p class="tagline">Are frontier AI labs keeping the dated safety promises <em>they</em> made? A per-promise, source-cited tracker.</p>
```

In `README.md`, update the one-line description to match (the "promises they made" framing) and add a sentence noting regulatory milestones are tracked separately as context. Keep "Not the first accountability project."

- [ ] **Step 3: Build + commit**

Run: `npm run build` (Expected: Complete.)
```bash
git -C ~/Desktop/overdue-ai add src/pages/methodology.astro src/pages/index.astro README.md
git -C ~/Desktop/overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "docs: M1 identity (promises they made) + inclusion criteria + related trackers"
```

---

## Task 6: Verify, deploy

- [ ] **Step 1: Full check**

Run: `npm test && npm run build`
Expected: all tests pass; build Complete; `grep -o 'data-reg' dist/index.html | wc -l` ≥ 1 (regulatory section rendered).

- [ ] **Step 2: Push (CI deploys)**

```bash
git -C ~/Desktop/overdue-ai push origin main
```
Then confirm the deploy run goes green and the live site shows the lab board + regulatory section.

- [ ] **Step 3: Screenshot** the updated board (lab promises + regulatory section beneath) for the project's records.
