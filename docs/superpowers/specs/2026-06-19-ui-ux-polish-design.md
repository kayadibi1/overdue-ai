# UI/UX Polish — Design

**Date:** 2026-06-19
**Status:** approved (scope = "implement all" from the live UI/UX review)

A focused visual/interaction polish pass on the live site (overduetracker.org), driven by a
browser-based UI/UX review across desktop (1440) and mobile (390) on seven page types. No new
features, no data changes, no architecture change. Each item below is a concrete, low-risk change.

## Scope corrections found while reading the code

Two review findings were re-scoped after inspecting source:

- **Wide-screen centering — DROPPED.** `body` is already `max-width: 920px; margin: 0 auto`. The
  "left-of-center" impression on detail pages is just the narrower reading column inside the
  centered band. Nothing to do.
- **Homepage email capture — already present.** `index.astro` already renders `<Subscribe />`
  (bottom, in the "Latest updates" teaser) and a rich footer data/nav row. So this becomes a
  *styling* fix (below), not an "add it" task.

One new issue surfaced from the code:

- **Lab-page scorecard is a dead control (a11y bug).** `labs/[lab].astro` reuses `<SummaryStats>`,
  which renders each stat with `role="button"`, `tabindex="0"`, and `aria-label="Filter the board
  to …"` — but the lab page has no `board.ts`, so these are focusable buttons that do nothing.
  Fix folded into the scorecard work below.

## Changes

### 1. Subscribe form styling (highest impact)
`Subscribe.astro` uses `class="subscribe"` but `global.css` has **no `.subscribe` rules**, so the
input + button render as raw browser defaults — the conversion CTA is the least-polished element on
the site. Add a `.subscribe` layout (inline on desktop, wraps on mobile), a styled input
(`--line` border, radius, focus ring), and reuse the new `.btn` for the submit. Style
`.subscribe__status` so success/error states read clearly.

### 2. Shared button style (`.btn`)
Add a single flat, pill button style with an accent (`--upcoming #1570ef`) variant and a neutral
`.btn--ghost` variant. Apply `.btn` to the Subscribe submit, `.btn--ghost` to the table **Reset**
button and the new citation **Copy** button. The `.th-sort` header buttons stay text-styled (not
`.btn`).

### 3. Scorecard: semantic color + correct interactivity + a resting cue
- **Color:** each stat already carries a `stat--<status>` class; only `--overdue` is colored today.
  Color the other five numbers from existing tokens (`--upcoming`, `--missed`, `--met`,
  `--partial`, `--pending`) so the board's shape reads at a glance.
- **Interactivity prop:** add `interactive` (default `true`) to `SummaryStats`. When `false`, render
  plain `<div class="stat …">` with **no** `role`/`tabindex`/`aria`/filter data. Homepage passes the
  default (clickable, filters the board); **lab page passes `interactive={false}`** (fixes the dead
  control).
- **Resting cue:** when interactive, render a small caption ("Tap a metric to filter the board")
  below the grid so the filter affordance isn't hover-only. Keep existing hover/focus states.

### 4. Explore table discoverability
In `table.astro`'s scoped style: a faint default ` ⇅` glyph on every `.th-sort` (overridden by the
existing `▲`/`▼` when a column is `aria-sort`ed), a subtle `tbody tr:hover` highlight, and column
tuning (date columns `white-space: nowrap`, a `min-width` on the Commitment column so it stops
wrapping to 3–4 lines while dates have excess width).

### 5. Detail page: ruling casing, copy citation, footer nav
- **#7 casing:** the timeline RULING card shows lowercase `met`; render it title-cased
  (`Met`/`Missed`/`Partial`) to match the status chip.
- **#8 copy:** add a `.btn--ghost` **Copy** button beside the citation, backed by a small DOM-only
  island (`scripts/cite.ts`, guarded like `table.ts`) using `navigator.clipboard`; show "Copied".
- **#9 nav:** deep pages (`/c/…`, `/labs/…`) are nav dead-ends (only Back · Lab · Table). Add a
  compact footer nav line (Board · Table · Methodology · Updates · Corrections · JSON · CSV) to both.

### 6. Favicon
No `public/` dir and `/favicon.ico` 404s on every page. Add `public/favicon.svg` (a small red
"overdue clock" mark) and a base-aware `<link rel="icon">` to each page `<head>` (uses
`import.meta.env.BASE_URL`, so the `PAGES=1` backup resolves correctly too).

### 7. "Contested" de-emphasis
`.contested` is amber (`--partial`) and appears on most cards; when a flag is on nearly everything it
reads as alarm. Recolor to `--muted` so it stays informative but quiet. (The *threshold* for the
flag is editorial and intentionally out of scope.)

## Deliberately out of scope
- A shared `BaseLayout`/`SiteFooter` refactor. It would DRY up the per-page head/footer duplication,
  but migrating all 8 pages is a larger change with more regression surface than a polish pass
  warrants. The favicon link and deep-page footer nav are done per-page instead. Revisit later.
- Changing the contested-flag *threshold* (editorial/data judgment, not UI).

## Testing & verification
These are presentational/markup changes with **no new pure-logic functions**, so no new unit tests
(consistent with the existing untested DOM islands `table.ts` / `subscribe.ts`). Verify by: full
existing `vitest` + `pytest` suites stay green (regression guard), both `npm run build` and
`PAGES=1 npm run build` succeed, and a browser re-check of home / table / detail / lab on desktop +
mobile. Then CHANGELOG + commit + push + live verify.
