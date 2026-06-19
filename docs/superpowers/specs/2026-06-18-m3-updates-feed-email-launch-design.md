# Milestone 3 — Updates: feed, email, launch (Design)

**Date:** 2026-06-18
**Status:** Approved (brainstorm) → spec for review
**Depends on:** M1 (dataset + board), M2 (watcher). Standalone within `overdue-ai`.

## Goal

Give Overdue a public "what changed" channel so people can follow it without re-checking the site: a curated **updates log** on the site, an **RSS feed** built from it, **email** delivery via Buttondown (RSS→email), and a **launch writeup** to announce it.

## Context

`overdue-ai` is a static Astro 5 site (GitHub Pages, `site: https://kayadibi1.github.io`, `base: /overdue-ai`). Endpoints are hand-rolled with `prerender` (see `src/pages/commitments.json.ts`). There is **no backend**, so email subscribe must use a third-party service. The watcher (M2) already detects source/deadline changes and opens GitHub issues; those issues are the *prompt* for a human to write an update entry — the watcher never writes the log itself.

## Decisions (from brainstorm)

1. **Source of truth = a curated updates log** (`src/data/updates.ts`), hand-written. Not auto-generated from data diffs. High-signal, editorial, keeps control of what's published.
2. **Email = Buttondown, RSS→email.** Write the entry once → feed carries it → Buttondown emails each new feed item. Free ≤100 subscribers. Own list + branding. The only new external dependency.
3. **Feed = hand-rolled** `prerender` endpoint (matches the existing JSON endpoint; no new package). We own XML escaping and unit-test it.
4. **A dedicated `/updates` page** (gives feed items real permalinks: `/updates#<id>`), plus the latest 2 surfaced on the homepage.

## Architecture — one source, three deliveries

```
src/data/updates.ts   ← source of truth (typed entries, hand-written)
      │
      ├── /updates        on-site page, newest-first; latest 2 on homepage
      ├── /feed.xml       RSS 2.0 built from updates.ts ──► RSS readers
      │                                                 └─► Buttondown ─► email subscribers
      └── Subscribe form  plain HTML POST → Buttondown embed endpoint (no backend, no JS)
launch writeup (Substack post) announces it once; same content seeds the first log entry.
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

Renders `sortUpdates(UPDATES)` newest-first. Each entry: date, title, body, links to any referenced commitments (by id → title), and the source link if present. Each entry wrapped in `id="<update.id>"` so `/updates#<id>` deep-links. Includes the Subscribe block and a visible "RSS" link to `/feed.xml`. Matches the existing light theme / page chrome used by `index.astro` and `methodology.astro`.

### 3. Homepage integration — `src/pages/index.astro` (modify)

Add a compact **"Latest updates"** block (top 2 from `sortUpdates`, each linking to `/updates#<id>`, plus a "see all / RSS" link) and a **"Follow"** block (RSS link + Subscribe form). Placed without disturbing the existing board/regulatory sections.

### 4. RSS feed — `src/pages/feed.xml.ts` (hand-rolled)

`export const prerender = true`. Emits RSS 2.0:

- `<channel>`: title "Overdue — frontier AI safety commitments", `<link>` to the site, `<description>`, `<atom:link rel="self">` to the feed URL, `<lastBuildDate>`.
- `<item>` per update (newest-first): `<title>`, `<link>`=`<site>/updates#<id>`, `<guid isPermaLink="false">`=`<id>`, `<pubDate>`=RFC-822 from `date`, `<description>`=body.
- Absolute URLs via `src/lib/urls.ts`: a **pure** `joinUrl(site, base, path)` (testable without Astro env) plus a thin `absUrl(path)` wrapper that supplies `import.meta.env.SITE` + `BASE_URL`. The unit test targets `joinUrl`.
- **XML escaping:** an `escapeXml()` helper escapes `& < > " '` in all interpolated text. Unit-tested with adversarial input (e.g. `Anthropic & Co. <test> "x"`).
- `Content-Type: application/xml; charset=utf-8`.

Autodiscovery: add `<link rel="alternate" type="application/rss+xml" href="…/feed.xml">` to `<head>`. Planning first locates the head: if a shared Layout/head partial exists, add it once there; otherwise add it to each page head (`index.astro`, `updates.astro`, `methodology.astro`).

### 5. Email subscribe — `src/components/Subscribe.astro`

A plain, no-JS form:

```html
<form action="https://buttondown.com/api/emails/embed-subscribe/{BUTTONDOWN_USERNAME}" method="post" target="_blank">
  <label>Email <input type="email" name="email" required></label>
  <button type="submit">Subscribe</button>
</form>
```

- `BUTTONDOWN_USERNAME` lives in one config constant (`src/lib/site.ts`), placeholder until the account exists.
- No third-party JS, no tracking added. On submit (no JS) the browser navigates to Buttondown's hosted confirm page in a new tab (`target="_blank"`) — acceptable UX for a static site.
- Used in the footer area, on `/updates`, and in the homepage Follow block.

### 6. Launch writeup — `docs/launch/2026-06-18-overdue-launch.md`

A Markdown draft (in-repo, for reference) the user pastes into their **existing** Substack. Email runs through Buttondown, so Substack is only the announcement venue. Angle: *"the promises frontier labs made — and how this stays honest."* Covers: what it tracks, lab vs regulatory split, the methodology + watcher, how to follow (site / RSS / email). Ends with links. The same content (condensed) seeds the first `UPDATES` entry (`id: '2026-06-18-launch'`).

## Config — `src/lib/site.ts` (new, small)

```ts
export const SITE_NAME = 'Overdue';
export const BUTTONDOWN_USERNAME = 'overdue'; // TODO set to the real Buttondown username after account creation
```
(`SITE`/`BASE` already come from `astro.config`; `absUrl()` reads them.)

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
- `src/lib/site.ts` — site constants + Buttondown username
- `src/pages/updates.astro` — updates page
- `src/pages/feed.xml.ts` — RSS endpoint
- `src/components/Subscribe.astro` — subscribe form
- `docs/launch/2026-06-18-overdue-launch.md` — writeup draft
- `tests/updates.test.ts` — sort + integrity + escapeXml + absUrl tests

**Modify:**
- `src/pages/index.astro` — Latest updates + Follow blocks
- `<head>` — feed autodiscovery `<link>` (shared Layout if one exists, else per-page)
- footer (locate existing footer markup during planning) — Subscribe form
- `CHANGELOG.md` — **M3 entry, written in the same commit as the feature** (the structural fix in action)
- `README.md` — mention feed + subscribe

## Manual steps (cannot be automated)

1. Create a **Buttondown** account; set `BUTTONDOWN_USERNAME` in `src/lib/site.ts`.
2. In Buttondown, enable RSS-to-email pointed at `https://kayadibi1.github.io/overdue-ai/feed.xml`.
3. Paste the writeup into Substack and publish.

## Out of scope (YAGNI)

- Auto-generating updates from dataset diffs (chose curated).
- JS-enhanced inline subscribe success (plain POST redirect is fine for v1).
- A custom domain (separate decision, later).
- Per-update individual pages (anchors on one page suffice).
- `@astrojs/rss` (chose hand-rolled).

## Risks / tradeoffs

- **New dependency (Buttondown):** an external list host + a free-tier cap (≤100) + deliverability to own. Mitigation: the feed is the source of truth, so the email layer is swappable — if Buttondown disappoints, repoint another RSS→email service at the same `/feed.xml` with no content rework.
- **Hand-rolled XML:** escaping is the failure mode; mitigated by `escapeXml` + adversarial unit test.
- **No-JS subscribe redirects** to Buttondown's page — minor UX cost, accepted for v1.
```
