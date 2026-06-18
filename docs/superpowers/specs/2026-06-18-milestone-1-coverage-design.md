# Overdue — Milestone 1: Credible Reference (Coverage + Positioning) — Design Spec

- **Date:** 2026-06-18
- **Status:** Approved design (pending final spec review before implementation plan)
- **Revised:** 2026-06-18 — self-review pass: liveness honesty (regulatory shown *beneath* the board, ≥3 live floor), quality-gated coverage (≥30, not ≥40), regulatory countdown-only semantics, explicit `track` rules, per-lab summary cut.
- **Project:** Overdue (https://github.com/kayadibi1/overdue-ai). Builds on `2026-06-18-overdue-design.md`.

## 0. Where this sits

We're turning Overdue from a hackathon artifact into a **living, maintained AI-safety accountability tool people rely on**. Roadmap:

- **M1 (this spec) — Credible reference:** comprehensive, well-sourced data + a sharper identity + clear positioning.
- **M2 — Freshness:** a source-change watcher (GitHub Action) that opens review issues, plus deadline reminders. *(separate spec)*
- **M3 — Distribution + retention:** RSS feed, email subscribe, launch writeup. *(separate spec)*

M1 is **~80% rigorous curation + a sharper identity, ~20% small code.**

## 1. Identity

The through-line becomes: **"Are the labs keeping the promises *they* made?"**

The core board tracks **only commitments the labs themselves made** — voluntary pledges, self-imposed deadlines, and signed multi-lab commitments (Seoul, White House voluntary commitments). Government *laws* (EU AI Act dates) are **not** lab promises and are not scored as kept/broken; they appear in a clearly separate **"Upcoming regulatory milestones"** section **beneath** the lab board — always visible, countdown-only context, never scored kept/broken.

Tagline/`<title>`/README update to reflect this framing. No "first" claims (carries over from the base spec).

## 2. The one schema change

Add a `track` field to `Commitment` (in `src/lib/types.ts`):

```ts
export type Track = 'lab' | 'regulatory';
// in Commitment:
track: Track;   // 'lab' = a promise the lab made (scored); 'regulatory' = a law/milestone (context)
```

- Default conceptual value is `'lab'`; every row sets it explicitly (the data test enforces presence).
- **Board behavior:** the main board renders `track === 'lab'` rows, most-overdue-first. The `regulatory` rows render in an always-visible, labeled **"Upcoming regulatory milestones"** section **beneath** the lab board — *not* hidden, in a lighter, clearly-distinct presentation (not the full scored card).
- **Regulatory semantics (self-review #3):** a regulatory row is a countdown to when a law applies — only `upcoming` (counting down), or once the date passes a static **"in force since &lt;date&gt;."** It is never given an `overdue`/`missed`/`met`/`partial` ruling and carries no `contested` flag. (Implementation: the regulatory section derives a simple countdown from the date, independent of `computeStatus`.)
- **Summary stats + the headline "overdue now"** are computed over the **`lab` track only** (the accountability claim is about lab promises). Regulatory items still get timers but are excluded from the headline counts.
- `sortByUrgency`, `computeStatus`, `relativeTime` are unchanged — they operate per-row regardless of track.

## 3. Re-audit of the current 25 rows

- **Stay `lab`:** xAI updated-policy, Meta Seoul framework, OpenAI Superalignment, OpenAI Preparedness annual review, Anthropic ASL-4, Anthropic Risk Report cadence, Anthropic third-party review, Anthropic LTBT, Anthropic sabotage reports, DeepMind FSF, Microsoft framework, White House voluntary commitments, Seoul commitments, AISI access MOUs (lab–government agreements the labs entered), UK AISI pre-deployment access, etc.
- **Reclassify `regulatory`:** the EU AI Act rows (high-risk 2026-08-02, legacy-GPAI 2027-08-02, Annex I 2027-08-02, first review 2028-08-02).
- Drop nothing solely for being regulatory — just relabel.

## 4. Coverage target

Grow **`lab`-track rows to ~30–45** well-sourced commitments (floor **≥30**, **quality-gated** — as many as genuinely meet the bar, *not a number to hit*; a tight ~32 airtight rows beats 50 with filler) across **OpenAI, Anthropic, Google DeepMind, xAI, Meta, Microsoft** (+ Amazon/Mistral *only if* they made specific dated promises). Plus the ~5 `regulatory` rows.

**Liveness (self-review #1):** moving EU rows out of the scored set removes ~6 of the 7 current live rows. We do **not** force a high live-lab count (that pressures invented dates). Instead: (a) a floor of **≥3 live `lab` rows** is sufficient; (b) the **regulatory section beneath the board** keeps honest live countdowns on the page; (c) any **recurring obligation** with a *derived* next-date is **`contested: true`** with the derivation in `notes`. Add genuine upcoming/recurring lab items where they actually exist:
- **Upcoming:** next scheduled RSP / Frontier Safety Framework / Preparedness Framework reviews where a lab published a cadence or a dated next-review.
- **Recurring obligations:** "publish a safety/system/risk report with every frontier model launch" (Anthropic, OpenAI, DeepMind) — modeled with a next-expected date.
- **Announced future policies** with a stated date.

Candidate sources to mine (each row web-verified): each lab's RSP/FSF/Preparedness pages + version histories, their model/system cards and release notes, official summit pledge texts (gov.uk Seoul/Bletchley), the White House 2023 commitments, AISI publications, and the prior research/appendix already in `2026-06-18-overdue.md`.

## 5. Sourcing & quality standard

Formalize the inclusion bar and write it into the methodology page as an **"Inclusion criteria"** block:

1. **Specific + dated** — a public statement with a calendar deadline *or* a falsifiable trigger (release/compute-based). Vague/aspirational pledges excluded.
2. **Lab-made** (for the `lab` track) — a promise the lab itself made or signed; not a law.
3. **One rock-solid public source**, primary preferred; **"missed"/negative rulings require especially strong sourcing** (a primary or major-press source, never a lone wiki).
4. **Neutral phrasing** — state the deadline and what shipped by it; no editorializing verbs.
5. **Debatable → `contested: true`**, phrased as a question, not a verdict.
6. **The `track` call (self-review #4):** a pledge a lab *made or signed* = `lab` (Seoul, White House, RSP/FSF/Preparedness, AISI MOUs the lab entered). A statutory deadline that applies by law = `regulatory` (EU AI Act). A unilateral government *expectation* the lab never agreed to → `regulatory`, or drop. When genuinely ambiguous, default to `regulatory` (the more conservative, less-accusatory bucket).
7. **Recurring/derived dates (self-review #6):** any "next X due ~DATE" inferred from a cadence rather than a lab-stated date is `contested: true` with the derivation in `notes`.

Every added row is **web-verified at the same bar that caught the false xAI claim** in the base build (re-confirm date, outcome, and that the `evidenceUrl` resolves and is on-topic).

## 6. Positioning (complement, don't compete)

Add a **"Related trackers"** section to the methodology page: how Overdue relates to The Midas Project (one Seoul deadline), METR (`/fsp`, policy-document index), AI Lab Watch, the FLI AI Safety Index, and SaferAI — and what Overdue adds (per-promise, dated, live counters, per-row evidence). Reaffirm: not the first; complementary.

**Outreach** to Midas/METR (introducing the project, offering to cross-link) is a **human action the user takes**, not a build step. Out of scope for the implementation; a drafted note can be produced separately on request.

## 7. UX changes (small; YAGNI otherwise)

- **Regulatory section beneath the board** (§2): always-visible, labeled "Upcoming regulatory milestones," countdown-only, lighter styling. No toggle.
- **Cut the per-lab summary strip (self-review #5):** a league-table framing tilts the product adversarial; the neutral per-promise framing is the edge. (Revisit later only if it can stay neutral.)
- No other UI work in M1.

## 8. Testing

- **`data.test.ts` updates:** every row has a valid `track` (`'lab'|'regulatory'`); **≥3 LIVE rows *within the `lab` track*** (overdue/upcoming, unresolved); **≥30 `lab`-track rows** (raise the floor from 20); **regulatory rows carry a date and no kept/broken `resolution`** (countdown-only); existing schema rules unchanged.
- **`status.test.ts`** unchanged (logic is track-agnostic).
- **Architecture (no signature change):** the page partitions rows by `track`, computes the summary + most-overdue sort over the **`lab`-track list only**, and renders `regulatory` rows in their own section — so `summarize`/`sortByUrgency`/`computeStatus`/`relativeTime` keep their current signatures (the page just passes the filtered list). A `data.test.ts` assertion confirms the `lab` vs `regulatory` split (counts of each) so the partition can't silently break.

## 9. Success criteria

- Core board shows **~30–45 `lab`-track commitments**, sorted most-overdue-first, in the clean theme.
- **≥3 live `lab`-track rows** (we don't force more — honesty over a vanity count); the regulatory section keeps live countdowns on the page.
- EU/regulatory rows present in a labeled section **beneath** the board (countdown-only), excluded from the headline counts.
- Methodology page carries the **Inclusion criteria** + **Related trackers** sections; tagline/README reflect the "promises they made" identity.
- All tests pass; build + deploy green; every added row web-verified and neutrally phrased.
- No "first" claims; positioning explicitly complementary.
