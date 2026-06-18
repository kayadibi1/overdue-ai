# Overdue — Frontier AI Safety Commitment Tracker — Design Spec

- **Date:** 2026-06-18
- **Status:** Approved design (pending final spec review before implementation plan)
- **Context:** MLH Global Hack Week "Hacking for Good" — *Help a Nonprofit / support a cause* challenge.
- **Revised:** 2026-06-18 — objective-fit pass: data liveness (#1), neutral & sourced tone (#2), nonprofit framing (#3).

## 1. Goal

A clean, source-cited web board that answers one question:

> **"Which dated frontier-AI-safety commitments are being kept — and which are overdue right now?"**

Per-commitment rows across the major AI labs, each with a status chip and a **live, self-updating timer** (counts up if overdue, down if upcoming), and every claim backed by one evidence link. Built honestly: no "world-first" claims, with a methodology page explaining what counts and how rulings are made.

**Who it serves:** AI-accountability nonprofits (METR, FLI, SaferAI, The Midas Project are all nonprofits), accountability journalists, and policy staff who need a fast "who is overdue *now*?" reference. It is a **free, open tool** those watchdog nonprofits and journalists can reuse and cite (open dataset + a "cite this" affordance). The MLH submission is framed primarily under **"support a cause you care about"** — the "help a nonprofit" angle is real but indirect (nonprofits are the audience, not a built-for beneficiary), so we make the reuse-by-nonprofits path concrete rather than leaning on that label.

## 2. Prior art & differentiation (validated by research)

Researched comprehensively: indie/OSS/GitHub/hackathons, think tanks/government/academia/journalists, prediction markets, plus a focused METR deep-dive.

- **The exact artifact does not exist:** no single live, sortable, *per-commitment* board of *many* dated promises across all labs, with Met/Missed/Overdue/Upcoming/Pending + a live days-overdue counter + per-row evidence links. GitHub search for the concept returns zero; no think tank, government body, or journalist runs a standing board; prediction markets don't cover it.
- **Closest existing thing — The Midas Project "Seoul Tracker":** tracks **one** collective deadline (Feb 2025), uses letter grades, and has **no per-commitment deadlines, no overdue counter, and no evidence links.** Our novelty over it = **breadth + per-item granularity + the live countdown mechanic + per-row evidence.** A difference of *scope and mechanic*, not a new concept. **We cite Midas and do not claim to be first.**
- **METR (`/fsp`, `/common-elements`):** a policy-*document* index + content-comparison matrix. Tracks **publication dates of documents**, not **self-imposed deadlines**, and has no status/overdue/compliance tracking. **Upstream source material we can cite, not a competitor.**
- **FLI AI Safety Index / SaferAI ratings:** periodic letter-grade scorecards of overall posture — not per-commitment deadline tracking.
- **Honesty risk:** the accountability space is crowded and Midas owns the "did labs keep their promises" narrative. The UI must make the differentiator legible: **"per-commitment, across all labs — not a single-deadline scorecard."**

## 3. Scope

**In (v1):**
- A seeded, typed dataset of ~30 dated commitments (already researched + sourced).
- **Live-items requirement (objective-fit #1):** the dataset MUST include a real cluster of *live* rows — currently overdue-and-unresolved promises, upcoming future deadlines, and recurring obligations — so the live timers (our differentiator vs. a static scorecard) actually fire instead of a wall of resolved history.
- **Open data (objective-fit #3):** the dataset is published as reusable **open JSON** with a "cite this" affordance, so watchdog nonprofits and journalists can reuse it.
- A board of one **card per commitment**, sorted **most-overdue-first**.
- **Live timer** per dated row (counts up overdue / down to upcoming), self-computed from dates.
- Status chips: Met / Missed / Partial / Overdue / Upcoming / Pending; a `contested` flag.
- A summary strip with a headline **"X overdue right now."**
- Filter by **Lab** and **Status** (and Category); sort controls.
- A **methodology** page (what counts, how ruled, disclaimer, corrections-welcome).
- README with honest positioning + sources.
- vitest tests (pure logic + data integrity) and GitHub Pages deploy.

**Out (deliberately, YAGNI):** user submissions, any backend/DB, auth, scraping/automation, accounts, charts beyond the summary counts. It is a static artifact; the timers self-compute so it stays "alive" with zero upkeep.

## 4. Tech & architecture

- **Astro (static, `output: 'static'`) + TypeScript.** Deploy to **GitHub Pages** via a small Actions workflow (`astro build` → deploy).
- **vitest** for unit tests. No client framework runtime — one vanilla `<script>` island for live timers + filter/sort.
- Repo: new public `kayadibi1/overdue-ai`. Local project at `~/Desktop/overdue-ai`.

**File layout:**
```
overdue-ai/
  src/
    data/commitments.ts        # typed COMMITMENTS: Commitment[] (seed dataset)
    lib/
      types.ts                 # Commitment, Status, enums
      status.ts                # PURE: computeStatus, relativeTime, summarize, sortByUrgency
    components/
      CommitmentCard.astro
      StatusChip.astro
      SummaryStats.astro
    scripts/board.ts           # client island: live timer tick + filter/sort (imports lib/status)
    pages/
      index.astro              # the board
      methodology.astro        # what counts / how ruled / disclaimer
    styles/global.css          # clean light theme
  tests/
    status.test.ts             # pure-logic tests (test-first)
    data.test.ts               # data-integrity over the real dataset
  .github/workflows/deploy.yml # GitHub Pages
  astro.config.mjs  package.json  README.md  LICENSE
```

## 5. Data model

```ts
type Lab =
  | 'OpenAI' | 'Anthropic' | 'Google DeepMind' | 'xAI' | 'Meta'
  | 'Microsoft' | 'Mistral' | 'Amazon' | 'Multi-lab';

type Category =
  | 'safety-framework' | 'evaluations' | 'governance'
  | 'transparency' | 'security' | 'access' | 'compute-pledge';

type Resolution = 'met' | 'missed' | 'partial' | null;   // null = unresolved
type Status = 'met' | 'missed' | 'partial' | 'overdue' | 'upcoming' | 'pending';

interface Commitment {
  id: string;                 // 'xai-fsp-update-2025'
  lab: Lab;
  title: string;              // short label
  description: string;        // the actual promise (quoted/paraphrased)
  category: Category;
  committedOn: string;        // ISO date the promise was made
  deadlineType: 'calendar' | 'trigger';
  deadline: string | null;    // ISO date (calendar) | null (trigger)
  triggerText?: string;       // 'before reaching ASL-3', 'every 4x compute'
  resolution: Resolution;     // human ruling; null if unresolved
  resolvedOn: string | null;  // when the outcome was determined
  evidenceUrl: string;        // source link (required)
  sourceLabel: string;        // 'TechCrunch', 'gov.uk', 'Anthropic'
  contested?: boolean;        // honesty flag for disputable rulings
  notes?: string;             // one line of context
}
```

## 6. Status & timer logic (pure functions in `lib/status.ts`)

`computeStatus(c, now): Status`
- `resolution` set (`met`/`missed`/`partial`) → that status (terminal).
- unresolved + `calendar` + `deadline > now` → `upcoming`.
- unresolved + `calendar` + `deadline <= now` → `overdue`.
- unresolved + `trigger` → `pending`.

`relativeTime(c, now): { label, kind } | null`
- `overdue` → `{ "N days overdue", 'overdue' }` (counts up).
- `upcoming` → `{ "in N days", 'upcoming' }` (counts down).
- resolved with a deadline → optional static `"resolved N days late/early"`.
- `pending`/no date → `null` (card shows "awaiting *[triggerText]*").

Dates are treated as **UTC, day-granularity** to avoid timezone off-by-one; the timer ticks but stays stable.

`summarize(list, now)` → counts per status (drives the summary strip).
`sortByUrgency(list, now)` → **overdue (most overdue first) → upcoming (soonest) → pending → resolved**.

## 7. Page & components

- **`index.astro`** — Header (title "Overdue" + honest tagline + `N commitments · updated <date>` + links to Methodology and GitHub) → Summary strip ("X overdue right now" headline, then counts) → Controls (filter by Lab/Status/Category, sort) → the board of `CommitmentCard`s → Footer (disclaimer + differentiator line).
- **`CommitmentCard.astro`** — lab badge + category tag; the promise + one-line description; the **live timer** (big, colored: red overdue / blue upcoming / gray pending); `StatusChip`; "⚠ contested" when set; "Source: <label> ↗" + committed date.
- **`StatusChip.astro`** — colored pill (Met green · Missed red · Partial amber · Overdue red · Upcoming blue · Pending gray).
- **`SummaryStats.astro`** — the stat strip (rendered at build, refreshed client-side so "overdue now" is live).
- **`scripts/board.ts`** — one client island: a `setInterval` recomputes `now` and updates each `[data-deadline]` timer (and flips a chip if a boundary crosses); filter/sort controls toggle card visibility + reorder via `data-lab/status/days/date`. Imports the same `lib/status.ts` as the build, so server HTML and client updates never diverge.
- **Visual:** clean **light** theme, **monospace numerals** on timers; the ticking red overdue number is the visual hero.

## 8. Data flow

`commitments.ts` (typed array) → `lib/status.ts` pure functions used by **both** Astro frontmatter (build-time render: sorted cards + summary) **and** the client island (live tick + filter/sort). Single source of truth.

## 9. Error handling / edge cases

- **Trigger items** (no date) → no ticking timer; "awaiting *[trigger]*"; sorted after dated items.
- **Resolved items** → terminal chip; optional static "resolved N days late."
- **Empty filter result** → friendly "No commitments match these filters."
- **No-JS / script error** → cards still render server-side with build-time status (graceful degradation); only the live tick is lost.
- **Contested items** → shown and visibly flagged (honesty over hiding).

## 10. Testing (vitest, test-first)

- **`status.test.ts`** — `computeStatus` (resolved→terminal; future→upcoming; past+unresolved→overdue; trigger→pending), `relativeTime` (sign/labels + deadline-is-today boundary), `summarize` (counts), `sortByUrgency` (ordering). Pure, no DOM.
- **`data.test.ts`** — over the real `COMMITMENTS`: required fields present; valid `lab`/`category` enums; `calendar ⇒ deadline set`; `trigger ⇒ triggerText set`; `evidenceUrl` is a valid URL; unique `id`s; parseable dates; `resolvedOn >= committedOn` sanity.

## 11. Deploy

GitHub Pages via `.github/workflows/deploy.yml`: `astro build` → upload `dist/` → deploy to Pages. Static only, no server adapter. `astro.config.mjs` sets `site` and `base` for the Pages URL.

## 12. Methodology page (credibility)

- **What counts:** a "specific, dated" commitment = a public statement with a calendar deadline *or* a falsifiable trigger (release/compute-based). Vague/aspirational pledges are excluded.
- **How rulings are made:** met/missed/partial are human judgments; overdue/upcoming are computed from dates. Genuinely disputable rulings are flagged `contested`.
- **Disclaimer:** independent, best-effort, unaffiliated with any lab; corrections welcome via GitHub issue.
- **Editorial principles (objective-fit #2 — neutral & defensible):** strictly factual, neutral phrasing — state the deadline and what shipped by it; **no editorializing verbs** ("backpedalled", "broke", "failed"). Include a ruling only when a rock-solid public source supports it; phrase anything genuinely debatable as a `contested` question, not a verdict. (Design constraint: the author is job-hunting in this ecosystem, so accuracy and neutrality protect both the tool's credibility and the author.)
- **Open data (objective-fit #3):** the commitments dataset is published as open JSON for watchdog nonprofits, journalists, and researchers to reuse; the page invites that reuse.
- **Relationship to prior work:** cites The Midas Project (Seoul Tracker), METR (`/fsp`), AI Lab Watch, FLI, SaferAI as sources/related work.

## 13. Seed dataset (v1, ~30 items, pre-sourced)

Already gathered during research, each with a source URL. Spans: the Seoul "publish a safety framework by the Paris summit" pledge; **xAI's two missed deadlines** (Feb 10 → May 10, 2025); Anthropic RSP/ASL milestones and version dates; OpenAI Superalignment "20% compute" + Preparedness Framework cadence; Google DeepMind Frontier Safety Framework dates; White House 2023 voluntary commitments; US/UK AISI access MOUs; EU GPAI Code dates; Meta/Microsoft framework publications. ~Half are clean calendar deadlines; the rest are explicit triggers. Vague items excluded. Each row needs a defensible status ruling + one durable evidence link.

**Composition requirement (objective-fit #1):** the seed set MUST include several **live** rows — a handful of currently overdue-and-unresolved promises and upcoming future deadlines, plus **recurring obligations** (e.g., "publish a safety/system report with every frontier model launch") that stay perpetually near-term — so the live timers are visibly active, not a wall of resolved history. Prefer trigger items that already have a known resolution so they carry signal. Tone stays neutral and every row is sourced (see Methodology).

## 14. Success criteria

- Board renders ~30 cited commitments, sorted most-overdue-first, in a clean light theme.
- Live timers tick (overdue counts up, upcoming counts down).
- Filter by Lab + Status and the sort controls work.
- `status` + `data-integrity` tests pass.
- Methodology + disclaimer present; positioning cites Midas/METR (no "first" claim).
- **≥ ~8 rows are live** (overdue or upcoming, unresolved) so the timers are visibly active — not a static scorecard. *(objective-fit #1)*
- Tone is strictly neutral/factual; **every ruling is sourced**; debatable items flagged `contested`. *(objective-fit #2)*
- Dataset published as **open JSON**; the page invites watchdog-org / journalist reuse. *(objective-fit #3)*
- Builds and deploys to GitHub Pages.
- Repo + a screenshot ready to submit, framed under "support a cause."
