# Overdue — Milestone 1: Credible Reference (Coverage + Positioning) — Design Spec

- **Date:** 2026-06-18
- **Status:** Approved design (pending final spec review before implementation plan)
- **Project:** Overdue (https://github.com/kayadibi1/overdue-ai). Builds on `2026-06-18-overdue-design.md`.

## 0. Where this sits

We're turning Overdue from a hackathon artifact into a **living, maintained AI-safety accountability tool people rely on**. Roadmap:

- **M1 (this spec) — Credible reference:** comprehensive, well-sourced data + a sharper identity + clear positioning.
- **M2 — Freshness:** a source-change watcher (GitHub Action) that opens review issues, plus deadline reminders. *(separate spec)*
- **M3 — Distribution + retention:** RSS feed, email subscribe, launch writeup. *(separate spec)*

M1 is **~80% rigorous curation + a sharper identity, ~20% small code.**

## 1. Identity

The through-line becomes: **"Are the labs keeping the promises *they* made?"**

The core board tracks **only commitments the labs themselves made** — voluntary pledges, self-imposed deadlines, and signed multi-lab commitments (Seoul, White House voluntary commitments). Government *laws* (EU AI Act dates) are **not** lab promises and are not scored as kept/broken; they move to a clearly separate **"regulatory milestones"** lane shown as context.

Tagline/`<title>`/README update to reflect this framing. No "first" claims (carries over from the base spec).

## 2. The one schema change

Add a `track` field to `Commitment` (in `src/lib/types.ts`):

```ts
export type Track = 'lab' | 'regulatory';
// in Commitment:
track: Track;   // 'lab' = a promise the lab made (scored); 'regulatory' = a law/milestone (context)
```

- Default conceptual value is `'lab'`; every row sets it explicitly (the data test enforces presence).
- **Board behavior:** the main board renders `track === 'lab'` rows. A **"Show regulatory milestones"** toggle reveals the `regulatory` rows in a separate, clearly-labeled section (same card UI, but visually marked as context, not a scored promise).
- **Summary stats + the headline "overdue now"** are computed over the **`lab` track only** (the accountability claim is about lab promises). Regulatory items still get timers but are excluded from the headline counts.
- `sortByUrgency`, `computeStatus`, `relativeTime` are unchanged — they operate per-row regardless of track.

## 3. Re-audit of the current 25 rows

- **Stay `lab`:** xAI updated-policy, Meta Seoul framework, OpenAI Superalignment, OpenAI Preparedness annual review, Anthropic ASL-4, Anthropic Risk Report cadence, Anthropic third-party review, Anthropic LTBT, Anthropic sabotage reports, DeepMind FSF, Microsoft framework, White House voluntary commitments, Seoul commitments, AISI access MOUs (lab–government agreements the labs entered), UK AISI pre-deployment access, etc.
- **Reclassify `regulatory`:** the EU AI Act rows (high-risk 2026-08-02, legacy-GPAI 2027-08-02, Annex I 2027-08-02, first review 2028-08-02).
- Drop nothing solely for being regulatory — just relabel.

## 4. Coverage target

Grow **`lab`-track rows to ~40–50** well-sourced commitments across **OpenAI, Anthropic, Google DeepMind, xAI, Meta, Microsoft** (+ Amazon/Mistral *only if* they made specific dated promises). Plus the ~5 `regulatory` rows.

**Liveness consequence of §1:** moving EU rows out of the scored set removes most of our `upcoming` items, so M1 must deliberately add **`lab`-track live rows** for the timers to stay meaningful:
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

Every added row is **web-verified at the same bar that caught the false xAI claim** in the base build (re-confirm date, outcome, and that the `evidenceUrl` resolves and is on-topic).

## 6. Positioning (complement, don't compete)

Add a **"Related trackers"** section to the methodology page: how Overdue relates to The Midas Project (one Seoul deadline), METR (`/fsp`, policy-document index), AI Lab Watch, the FLI AI Safety Index, and SaferAI — and what Overdue adds (per-promise, dated, live counters, per-row evidence). Reaffirm: not the first; complementary.

**Outreach** to Midas/METR (introducing the project, offering to cross-link) is a **human action the user takes**, not a build step. Out of scope for the implementation; a drafted note can be produced separately on request.

## 7. UX changes (small; YAGNI otherwise)

- **Regulatory toggle** (§2): a control that reveals the `regulatory` section; default hidden/collapsed.
- **Optional** per-lab summary strip ("Anthropic 8 · 1 overdue"), if it reads cleanly; cut if it clutters.
- No other UI work in M1.

## 8. Testing

- **`data.test.ts` updates:** every row has a valid `track` (`'lab'|'regulatory'`); **≥6 LIVE rows *within the `lab` track*** (overdue/upcoming, unresolved); ≥40 `lab`-track rows (raise the floor from 20); existing schema rules unchanged.
- **`status.test.ts`** unchanged (logic is track-agnostic).
- **Architecture (no signature change):** the page partitions rows by `track`, computes the summary + most-overdue sort over the **`lab`-track list only**, and renders `regulatory` rows in their own section — so `summarize`/`sortByUrgency`/`computeStatus`/`relativeTime` keep their current signatures (the page just passes the filtered list). A `data.test.ts` assertion confirms the `lab` vs `regulatory` split (counts of each) so the partition can't silently break.

## 9. Success criteria

- Core board shows **~40–50 `lab`-track commitments**, sorted most-overdue-first, in the clean theme.
- **≥6 live `lab`-track rows** so timers stay meaningful after the EU rows leave the scored set.
- EU/regulatory rows present but behind the **"Show regulatory milestones"** toggle, excluded from the headline counts.
- Methodology page carries the **Inclusion criteria** + **Related trackers** sections; tagline/README reflect the "promises they made" identity.
- All tests pass; build + deploy green; every added row web-verified and neutrally phrased.
- No "first" claims; positioning explicitly complementary.
