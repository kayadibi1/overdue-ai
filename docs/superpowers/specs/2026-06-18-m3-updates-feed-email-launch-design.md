# Milestone 3 — Updates log + RSS feed + launch writeup (Design)

**Date:** 2026-06-18
**Status:** Approved (brainstorm + competitive scan) → spec for review
**Depends on:** M1 (dataset + board), M2 (watcher). Standalone within `overdue-ai`.

> **Scope split (decided):** M3 is the **content layer** — host-agnostic, ships on the current GitHub Pages URL. The **infra layer** — custom domain (`overduetracker.org`), move to newbox/Caddy, and the **email subscribe** microservice → Buttondown — is **M4** and gets its own spec. Email and the subscribe form are therefore *out of M3*; M3's "follow" affordance is the RSS feed.

## Goal

Give Overdue a public "what changed" channel so people can follow it without re-checking the site: a curated **updates log** on the site, an **RSS feed** built from it, and a **launch writeup** announcing it. (Email delivery of those updates is M4.)

## Positioning & prior art (why Overdue differs — drives the copy)

A 5-scenario prior-art scan (see memory `overdue-competitive-landscape`) found **no exact twin**, but two efforts each do *half* of Overdue:

- **The Midas Project — Seoul Commitment Tracker** ([seoul-tracker.org](https://seoul-tracker.org)) — live, maintained, sourced, met/partial/unfulfilled against a deadline, but scoped to the **single** Seoul red-line pledge. Same org's **Watchtower** is a live policy-diff feed.
- **AI Lab Watch** ([ailabwatch.org](https://ailabwatch.org/resources/commitments)) — the **full multi-regime breadth** Overdue wants, but as **unstructured prose with no deadlines/status**, and **abandoned since September 2025**.
- **Different lane (grades/indices, cite as sources not rivals):** FLI AI Safety Index, SaferAI ratings, Stanford FMTI, METR "Common Elements", and the Stanford paper *"Do AI Companies Make Good on Voluntary Commitments to the White House?"* (arXiv 2508.08345).

**Overdue's wedge:** *all* commitment regimes (Seoul + 2023 White House + RSP/FSF/Preparedness) in one **structured, sourced** board, with a **forward-looking deadline clock** that surfaces an explicit **upcoming/overdue** state nobody else offers — and **kept current**. This positioning must show up in: the methodology page ("How we differ / related trackers", citing the above openly, **no "first" claim**), and the launch writeup.

**Implication flagged for the user (not an M3 build task):** the "all regimes" claim is only credible if the **commitments dataset actually spans those regimes**. Current coverage is lab-promise-heavy. A dataset-coverage audit/expansion — seeded from AI Lab Watch's commitments page + the Stanford White-House paper + METR — should be its own follow-up (call it M3.5 / data) and is **not blocking** the feed/log build here.

## Context

`overdue-ai` is a static Astro 5 site (GitHub Pages, `site: https://kayadibi1.github.io`, `base: /overdue-ai`). Endpoints are hand-rolled with `prerender` (see `src/pages/commitments.json.ts`). The watcher (M2) detects source/deadline changes and opens GitHub issues; those issues are the *prompt* for a human to write an update entry — the watcher never writes the log itself.

## Decisions

1. **Source of truth = a curated updates log** (`src/data/updates.ts`), hand-written. Not auto-generated from data diffs. High-signal, editorial, keeps control of what's published.
2. **Feed = hand-rolled** `prerender` endpoint (matches the existing JSON endpoint; no new package). We own XML escaping and unit-test it.
3. **A dedicated `/updates` page** (gives feed items real permalinks: `/updates#<id>`), plus the latest 2 surfaced on the homepage.
4. **Email subscribe, custom domain, and the newbox move are M4** (the feed built here is exactly what M4's Buttondown RSS→email will consume).

## Architecture — one source, two deliveries now (email in M4)

```
src/data/updates.ts   ← source of truth (typed entries, hand-written)
      │
      ├── /updates        on-site page, newest-first; latest 2 on homepage
      ├── /feed.xml       RSS 2.0 built from updates.ts ──► RSS readers
      │                                                 └─► (M4) Buttondown ─► email
      └── launch writeup (Substack post) announces it once; same content seeds the first log entry
```

## Components

### 1. Updates log (the spine) — `src/data/updates.ts`

Typed array mirroring `commitments.ts`.

```ts
export interface Update {
  id: string;          // stable slug, unique, used as feed <guid> and #anchor, e.g. '2026-06-18-launch'
  date: string;        // 'YYYY-MM-DD' UTC, the publish date
  title: string;       // one line
  body: string;        // 1–3 sentences, plain text (no HTML); links expressed via the fields below
  commitmentIds?: string[]; // optional refs into COMMITMENTS (renders links on /updates)
  sourceUrl?: string;  // optional external source
  sourceLabel?: string;// label for sourceUrl
}
export const UPDATES: Update[] = [ /* seeded with the launch entry */ ];
```

Helper in `src/lib/updates.ts` (logic separate from data, mirroring how `status.ts` is separate from `commitments.ts`):

```ts
export function sortUpdates(items: Update[]): Update[]; // newest date first; ties broken by id desc for determinism
```

**Integrity rules (tested):** ids unique; `date` parses as a real UTC calendar date; every `commitmentIds` entry exists in `COMMITMENTS`; `sourceUrl` present iff `sourceLabel` present.

### 2. `/updates` page — `src/pages/updates.astro`

Renders `sortUpdates(UPDATES)` newest-first. Each entry: date, title, body, links to any referenced commitments (by id → title), and the source link if present. Each entry wrapped in `id="<update.id>"` so `/updates#<id>` deep-links. Includes a visible **"Follow via RSS"** link to `/feed.xml` (email subscribe is added here in M4). Matches the existing light theme / page chrome used by `index.astro` and `methodology.astro`.

### 3. Homepage integration — `src/pages/index.astro` (modify)

Add a compact **"Latest updates"** block (top 2 from `sortUpdates`, each linking to `/updates#<id>`, plus a "see all / RSS" link) and a **"Follow"** block (RSS link; M4 adds the email form here). Placed without disturbing the existing board/regulatory sections.

### 4. RSS feed — `src/pages/feed.xml.ts` (hand-rolled)

`export const prerender = true`. Emits RSS 2.0:

- `<channel>`: title "Overdue — frontier AI safety commitments", `<link>` to the site, `<description>`, `<atom:link rel="self">` to the feed URL, `<lastBuildDate>`.
- `<item>` per update (newest-first): `<title>`, `<link>`=`<site>/updates#<id>`, `<guid isPermaLink="false">`=`<id>`, `<pubDate>`=RFC-822 from `date`, `<description>`=body.
- Absolute URLs via `src/lib/urls.ts`: a **pure** `joinUrl(site, base, path)` (testable without Astro env) plus a thin `absUrl(path)` wrapper that supplies `import.meta.env.SITE` + `BASE_URL`. The unit test targets `joinUrl`. (M4 swaps the site constant to the custom domain — `joinUrl` stays.)
- **XML escaping:** an `escapeXml()` helper escapes `& < > " '` in all interpolated text. Unit-tested with adversarial input (e.g. `Anthropic & Co. <test> "x"`).
- `Content-Type: application/xml; charset=utf-8`.

Autodiscovery: add `<link rel="alternate" type="application/rss+xml" href="…/feed.xml">` to `<head>`. Planning first locates the head: if a shared Layout/head partial exists, add it once there; otherwise add it to each page head (`index.astro`, `updates.astro`, `methodology.astro`).

### 5. Launch writeup — `docs/launch/2026-06-18-overdue-launch.md`

A Markdown draft (in-repo, for reference) the user pastes into their **existing** Substack. Angle, reflecting the honest positioning: ***"Why I built Overdue — and how it differs from what's out there."*** Acknowledges Midas's Seoul Tracker (good, but narrow) and AI Lab Watch (broad, but went dark in Sept 2025), then states Overdue's wedge: all regimes + a live deadline clock with an explicit "overdue" state + maintained. Covers what it tracks, the lab vs regulatory split, the methodology + the M2 watcher (how it stays current), and how to follow (site / RSS now; email soon via M4). Ends with links. A condensed version seeds the first `UPDATES` entry (`id: '2026-06-18-launch'`).

### 6. Methodology page — `src/pages/methodology.astro` (modify)

Extend the existing "Related trackers" content into a short **"How Overdue differs"** subsection citing Midas (Seoul Tracker + Watchtower), AI Lab Watch (and that it's unmaintained since Sept 2025), and the grade/index efforts — framed neutrally, no "first/only" claim. This is where the prior-art honesty lives on-site.

## Config — `src/lib/site.ts` (new, small)

```ts
export const SITE_NAME = 'Overdue';
export const FEED_TITLE = 'Overdue — frontier AI safety commitments';
export const FEED_DESCRIPTION = 'Updates to the tracker of public AI-safety commitments and their deadlines.';
```
(`SITE`/`BASE` come from `astro.config`; `absUrl()` reads them. Buttondown username is added here in M4.)

## Testing

Vitest, no DOM (consistent with the project):
- `sortUpdates`: newest-first ordering; deterministic tie-break.
- Updates integrity: unique ids; valid dates; `commitmentIds` exist in `COMMITMENTS`; `sourceUrl`/`sourceLabel` paired.
- `escapeXml`: escapes `& < > " '`; leaves safe text untouched.
- `joinUrl`: joins site + base + path without double slashes; handles trailing/leading slashes.
- `npm run build` green; `/feed.xml` is well-formed (manual validate once).

## File structure

**Create:**
- `src/data/updates.ts` — log data (the `UPDATES` array + `Update` type)
- `src/lib/updates.ts` — `sortUpdates()`
- `src/lib/urls.ts` — pure `joinUrl()` + `absUrl()` wrapper
- `src/lib/site.ts` — site/feed constants
- `src/pages/updates.astro` — updates page
- `src/pages/feed.xml.ts` — RSS endpoint
- `docs/launch/2026-06-18-overdue-launch.md` — writeup draft
- `tests/updates.test.ts` — sort + integrity + escapeXml + joinUrl tests

**Modify:**
- `src/pages/index.astro` — Latest updates + Follow (RSS) blocks
- `src/pages/methodology.astro` — "How Overdue differs" prior-art subsection
- `<head>` — feed autodiscovery `<link>` (shared Layout if one exists, else per-page)
- `CHANGELOG.md` — **M3 entry, written in the same commit as the feature** (the binding fix in action)
- `README.md` — mention the feed + the prior-art positioning

## Manual step (cannot be automated)

1. Paste the writeup into Substack and publish. *(Email subscribe, custom domain, and newbox move are all M4.)*

## Out of scope for M3 (deferred or rejected)

- **Email subscribe / Buttondown** → **M4**.
- **Custom domain (`overduetracker.org`) + newbox/Caddy move** → **M4**.
- **Dataset breadth audit/expansion** to fully back the "all regimes" claim → **M3.5 (data)**, non-blocking.
- Auto-generating updates from dataset diffs (chose curated). 
- Per-update individual pages (anchors on one page suffice).
- `@astrojs/rss` (chose hand-rolled).

## Risks / tradeoffs

- **Competitive (the real one):** Midas could generalize the Seoul Tracker into Overdue's space. Mitigation = occupy the wedge they don't (all regimes + forward overdue/upcoming clock) and *actually maintain* it (the M2 watcher is the moat); cite them openly so Overdue reads as complementary, not derivative.
- **Positioning credibility:** claiming "all regimes" while the dataset is lab-promise-heavy would undercut the wedge — hence the flagged M3.5 data pass; until then the copy should claim what the data actually supports.
- **Hand-rolled XML:** escaping is the failure mode; mitigated by `escapeXml` + adversarial unit test.
```
