# Milestone 3 — Updates log + RSS feed + launch writeup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated on-site updates log, a hand-rolled RSS feed built from it, and a launch writeup — the host-agnostic content layer of M3 (email/domain/newbox are M4).

**Architecture:** `src/data/updates.ts` is the source of truth. Pure logic (`sortUpdates`, `joinUrl`/`absUrl`, `escapeXml`/`renderFeed`) lives in `src/lib/` and is unit-tested with Vitest (no DOM). Astro pages (`updates.astro`, modified `index.astro`/`methodology.astro`) and the `feed.xml.ts` endpoint render from those. Brand "Overdue"; canonical title "Overdue — AI Safety Commitment Tracker".

**Tech Stack:** Astro 5 (static, `prerender`), TypeScript, Vitest. No new dependencies (hand-rolled feed; `@astrojs/rss` rejected).

**Spec:** `docs/superpowers/specs/2026-06-18-m3-updates-feed-email-launch-design.md`

---

### Task 1: Site/feed constants

**Files:**
- Create: `src/lib/site.ts`

Config-only (TDD exception). 

- [ ] **Step 1: Create the constants**

```ts
export const SITE_NAME = 'Overdue';
export const FEED_TITLE = 'Overdue — AI Safety Commitment Tracker';
export const FEED_DESCRIPTION =
  'Updates to the tracker of public AI-safety commitments frontier labs made, and their deadlines.';
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/site.ts
git commit -m "feat(m3): site/feed constants"
```

---

### Task 2: URL helpers (`joinUrl` pure + `absUrl` wrapper)

**Files:**
- Create: `src/lib/urls.ts`
- Test: `tests/updates.test.ts` (new file; shared across M3 logic tasks)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { joinUrl } from '../src/lib/urls';

describe('joinUrl', () => {
  it('joins site + base + path with single slashes', () => {
    expect(joinUrl('https://x.org', '/overdue-ai', '/updates')).toBe('https://x.org/overdue-ai/updates');
  });
  it('tolerates missing/extra slashes and empty base', () => {
    expect(joinUrl('https://x.org/', 'overdue-ai/', 'updates')).toBe('https://x.org/overdue-ai/updates');
    expect(joinUrl('https://x.org', '/', '/feed.xml')).toBe('https://x.org/feed.xml');
    expect(joinUrl('https://x.org', '', 'feed.xml')).toBe('https://x.org/feed.xml');
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run tests/updates.test.ts`
Expected: FAIL — `joinUrl` not exported.

- [ ] **Step 3: Implement**

```ts
/** Join an origin, a base path, and a path into one absolute URL with single slashes. */
export function joinUrl(site: string, base: string, path: string): string {
  const origin = site.replace(/\/+$/, '');
  const mid = base.replace(/^\/+|\/+$/g, '');
  const tail = path.replace(/^\/+/, '');
  return [origin, mid, tail].filter(Boolean).join('/');
}

/** Astro-env wrapper: builds an absolute URL for `path` from the configured SITE + BASE_URL. */
export function absUrl(path: string): string {
  return joinUrl(import.meta.env.SITE ?? '', import.meta.env.BASE_URL ?? '/', path);
}
```

- [ ] **Step 4: Run tests; verify pass**

Run: `npx vitest run tests/updates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/urls.ts tests/updates.test.ts
git commit -m "feat(m3): joinUrl/absUrl helpers + tests"
```

---

### Task 3: Updates data model + `sortUpdates` + integrity

**Files:**
- Create: `src/data/updates.ts`
- Create: `src/lib/updates.ts`
- Modify: `tests/updates.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `tests/updates.test.ts`)

```ts
import { UPDATES } from '../src/data/updates';
import { sortUpdates } from '../src/lib/updates';
import { COMMITMENTS } from '../src/data/commitments';

describe('sortUpdates', () => {
  it('orders newest date first, deterministic tie-break by id desc', () => {
    const a = { id: 'a', date: '2026-01-01', title: 't', body: 'b' };
    const b = { id: 'b', date: '2026-02-01', title: 't', body: 'b' };
    const c = { id: 'c', date: '2026-02-01', title: 't', body: 'b' };
    expect(sortUpdates([a, b, c]).map((u) => u.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('UPDATES integrity', () => {
  it('has unique ids', () => {
    const ids = UPDATES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('has real UTC calendar dates (YYYY-MM-DD)', () => {
    for (const u of UPDATES) expect(u.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('references only existing commitments', () => {
    const known = new Set(COMMITMENTS.map((c) => c.id));
    for (const u of UPDATES) for (const id of u.commitmentIds ?? []) expect(known.has(id)).toBe(true);
  });
  it('pairs sourceUrl with sourceLabel', () => {
    for (const u of UPDATES) expect(Boolean(u.sourceUrl)).toBe(Boolean(u.sourceLabel));
  });
  it('is non-empty (seeded with the launch entry)', () => {
    expect(UPDATES.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run; verify fail**

Run: `npx vitest run tests/updates.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the data model + seed**

`src/data/updates.ts`:
```ts
export interface Update {
  id: string;
  date: string;            // 'YYYY-MM-DD' UTC
  title: string;
  body: string;            // 1–3 plain-text sentences
  commitmentIds?: string[];
  sourceUrl?: string;
  sourceLabel?: string;
}

export const UPDATES: Update[] = [
  {
    id: '2026-06-18-launch',
    date: '2026-06-18',
    title: 'Overdue launches',
    body:
      'A tracker of the public safety commitments frontier AI labs made — RSPs, frontier safety frameworks, the Seoul and White House commitments — each with its deadline and an explicit upcoming/overdue status. See how it differs from existing trackers on the methodology page.',
    sourceUrl: '/methodology',
    sourceLabel: 'Methodology',
  },
];
```

`src/lib/updates.ts`:
```ts
import type { Update } from '../data/updates';

/** Newest date first; ties broken by id descending for stable, deterministic order. */
export function sortUpdates(items: Update[]): Update[] {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}
```

- [ ] **Step 4: Run; verify pass**

Run: `npx vitest run tests/updates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/updates.ts src/lib/updates.ts tests/updates.test.ts
git commit -m "feat(m3): updates log data model + sortUpdates + integrity tests"
```

---

### Task 4: Feed rendering (`escapeXml` + pure `renderFeed`)

**Files:**
- Create: `src/lib/feed.ts`
- Modify: `tests/updates.test.ts`

(Putting the XML generation in a pure `renderFeed` makes the whole feed testable; `feed.xml.ts` in Task 5 just wraps it with env + a `Response`.)

- [ ] **Step 1: Write failing tests** (append)

```ts
import { escapeXml, renderFeed } from '../src/lib/feed';

describe('escapeXml', () => {
  it('escapes the five XML entities and leaves safe text alone', () => {
    expect(escapeXml('Anthropic & Co. <test> "x" \'y\'')).toBe('Anthropic &amp; Co. &lt;test&gt; &quot;x&quot; &apos;y&apos;');
    expect(escapeXml('plain text 123')).toBe('plain text 123');
  });
});

describe('renderFeed', () => {
  const opts = { siteUrl: 'https://x.org/overdue-ai', feedUrl: 'https://x.org/overdue-ai/feed.xml', title: 'Overdue — AI Safety Commitment Tracker', description: 'desc' };
  it('produces well-formed RSS with one item per update, newest first, escaped', () => {
    const xml = renderFeed([
      { id: 'old', date: '2026-01-01', title: 'A & B', body: 'first' },
      { id: 'new', date: '2026-02-01', title: 'Second', body: 'second' },
    ], opts);
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<title>Overdue — AI Safety Commitment Tracker</title>');
    expect(xml.indexOf('Second')).toBeLessThan(xml.indexOf('A &amp; B')); // newest first + escaped
    expect(xml).toContain('<guid isPermaLink="false">new</guid>');
    expect(xml).toContain('https://x.org/overdue-ai/updates#new');
    expect((xml.match(/<item>/g) || []).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run; verify fail**

Run: `npx vitest run tests/updates.test.ts`
Expected: FAIL — `src/lib/feed` not found.

- [ ] **Step 3: Implement**

```ts
import type { Update } from '../data/updates';
import { sortUpdates } from './updates';

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export interface FeedOpts { siteUrl: string; feedUrl: string; title: string; description: string; }

export function renderFeed(updates: Update[], o: FeedOpts): string {
  const items = sortUpdates(updates).map((u) => {
    const link = `${o.siteUrl.replace(/\/+$/, '')}/updates#${u.id}`;
    const pub = new Date(`${u.date}T00:00:00Z`).toUTCString();
    return `    <item>
      <title>${escapeXml(u.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(u.id)}</guid>
      <pubDate>${pub}</pubDate>
      <description>${escapeXml(u.body)}</description>
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(o.title)}</title>
    <link>${escapeXml(o.siteUrl)}</link>
    <description>${escapeXml(o.description)}</description>
    <atom:link href="${escapeXml(o.feedUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}
```

- [ ] **Step 4: Run; verify pass**

Run: `npx vitest run tests/updates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feed.ts tests/updates.test.ts
git commit -m "feat(m3): escapeXml + pure renderFeed + tests"
```

---

### Task 5: RSS endpoint `/feed.xml`

**Files:**
- Create: `src/pages/feed.xml.ts`

- [ ] **Step 1: Implement the endpoint**

```ts
import type { APIRoute } from 'astro';
import { UPDATES } from '../data/updates';
import { renderFeed } from '../lib/feed';
import { absUrl } from '../lib/urls';
import { FEED_TITLE, FEED_DESCRIPTION } from '../lib/site';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    renderFeed(UPDATES, {
      siteUrl: absUrl('/'),
      feedUrl: absUrl('/feed.xml'),
      title: FEED_TITLE,
      description: FEED_DESCRIPTION,
    }),
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
```

- [ ] **Step 2: Build and confirm the feed renders**

Run: `npm run build`
Expected: build succeeds; `dist/feed.xml` exists.

Run: `head -c 400 dist/feed.xml`
Expected: starts with `<?xml` and contains `<item>` with the launch update.

- [ ] **Step 3: Commit**

```bash
git add src/pages/feed.xml.ts
git commit -m "feat(m3): /feed.xml hand-rolled RSS endpoint"
```

---

### Task 6: `/updates` page

**Files:**
- Create: `src/pages/updates.astro`

- [ ] **Step 1: Inspect an existing page for chrome/theme conventions**

Read `src/pages/methodology.astro` to copy its layout/header/footer pattern, link styling, and how it sets `<title>`.

- [ ] **Step 2: Implement the page**

Render `sortUpdates(UPDATES)` newest-first. For each update output a section with `id={update.id}` containing: formatted date, `<h2>` title, body paragraph, links to referenced commitments (map `commitmentIds` → `COMMITMENTS` titles, linking to the board), and the source link if present. Add a visible "Follow via RSS" link to `absUrl('/feed.xml')` at top. Use `<title>Updates — Overdue</title>`. Match `methodology.astro`'s wrapper/markup exactly (same container classes, header, footer).

```astro
---
import { UPDATES } from '../data/updates';
import { sortUpdates } from '../lib/updates';
import { COMMITMENTS } from '../data/commitments';
import { absUrl } from '../lib/urls';
const updates = sortUpdates(UPDATES);
const titleOf = (id: string) => COMMITMENTS.find((c) => c.id === id)?.title ?? id;
---
<!-- reuse methodology.astro's html/head/body chrome; <title>Updates — Overdue</title>;
     add <link rel="alternate" type="application/rss+xml" href={absUrl('/feed.xml')} /> in <head> -->
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; `dist/updates/index.html` exists and lists the launch update.

- [ ] **Step 4: Commit**

```bash
git add src/pages/updates.astro
git commit -m "feat(m3): /updates page"
```

---

### Task 7: Homepage — Latest updates + Follow blocks; feed autodiscovery

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/methodology.astro` (autodiscovery `<link>` only)

- [ ] **Step 1: Locate the head**

Read `src/pages/index.astro`. Determine whether a shared Layout/head partial exists. If yes, add the autodiscovery `<link rel="alternate" type="application/rss+xml" href={absUrl('/feed.xml')} />` there once. If no, add it to the `<head>` of `index.astro`, `updates.astro` (done in Task 6), and `methodology.astro`.

- [ ] **Step 2: Add the homepage blocks**

In `index.astro`, import `UPDATES`, `sortUpdates`, `absUrl`. Add a compact "Latest updates" block rendering the top 2 of `sortUpdates(UPDATES)` (date + title linking to `/updates#<id>`) with a "See all updates" link to `/updates` and an "RSS" link to `absUrl('/feed.xml')`. Add a small "Follow" line (RSS link; note "email coming soon"). Place after the existing board/regulatory sections without disturbing them.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; homepage shows the latest update + RSS link; view-source shows the autodiscovery `<link>`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/methodology.astro
git commit -m "feat(m3): homepage latest-updates + Follow blocks + feed autodiscovery"
```

---

### Task 8: Methodology — "How Overdue differs" prior-art subsection

**Files:**
- Modify: `src/pages/methodology.astro`

- [ ] **Step 1: Add the subsection**

Extend the existing "Related trackers" area with a neutral "How Overdue differs" subsection. Cite, with links: The Midas Project — Seoul Commitment Tracker (`https://seoul-tracker.org`) and Watchtower; AI Lab Watch (`https://ailabwatch.org`), noting it is unmaintained since Sept 2025; and the grade/index efforts (FLI AI Safety Index, SaferAI, Stanford FMTI, METR). State Overdue's wedge: all commitment regimes in one structured board + a forward upcoming/overdue deadline clock + kept current. **No "first/only" claim.**

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds; methodology page shows the subsection with working links.

- [ ] **Step 3: Commit**

```bash
git add src/pages/methodology.astro
git commit -m "feat(m3): methodology 'How Overdue differs' prior-art subsection"
```

---

### Task 9: Launch writeup draft

**Files:**
- Create: `docs/launch/2026-06-18-overdue-launch.md`

- [ ] **Step 1: Write the draft**

Markdown the user can paste into Substack. Angle: *"Why I built Overdue — and how it differs from what's out there."* Structure: the gap (Midas's Seoul Tracker is great but narrow; AI Lab Watch had the breadth but went dark Sept 2025); what Overdue does (all regimes + deadline clock + the M2 watcher keeping it current); the lab vs regulatory split; how to follow (site / RSS now; email soon). End with links (site, `/methodology`, `/feed.xml`). Neutral, sourced tone; no over-claiming.

- [ ] **Step 2: Commit**

```bash
git add docs/launch/2026-06-18-overdue-launch.md
git commit -m "docs(m3): launch writeup draft"
```

---

### Task 10: README + CHANGELOG (changelog written WITH the feature — the binding fix)

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

Mention the updates log + `/feed.xml`, and the prior-art positioning (one line citing Midas / AI Lab Watch + the wedge).

- [ ] **Step 2: Add the CHANGELOG entry**

Newest-first, `## 2026-06-18 · M3 — updates log + RSS feed + launch writeup`, with scannable bullets: curated updates log (`src/data/updates.ts`); `/updates` page + homepage block; hand-rolled `/feed.xml` (escapeXml + pure renderFeed, tested); methodology "How Overdue differs" (cite Midas/AI Lab Watch); launch writeup; note email/domain/newbox deferred to M4.

- [ ] **Step 3: Full test + build green**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs(m3): README + CHANGELOG for M3"
```

---

## Self-Review checklist (run before building)

- Spec coverage: updates log ✅(T3) · /updates ✅(T6) · feed ✅(T4,T5) · homepage ✅(T7) · methodology positioning ✅(T8) · writeup ✅(T9) · changelog-in-same-wave ✅(T10).
- Type consistency: `Update` fields used identically in data, `sortUpdates`, `renderFeed`, and `updates.astro`. `joinUrl`/`absUrl`/`escapeXml`/`renderFeed` signatures match call sites.
- No placeholders: every code step has real code; Astro-page steps reference an existing page to copy chrome from.
