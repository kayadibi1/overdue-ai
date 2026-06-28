# Overdue — Milestone 2 (The Watcher) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A weekly GitHub Action that opens deduped review issues when a watched source page changes or a commitment's deadline comes due — without ever editing the dataset.

**Architecture:** Pure logic in `src/watcher/core.ts` (cheerio text-extract, hash, diff, due-deadline detection) is unit-tested; a thin runner `scripts/watch.ts` (run via `tsx`) does fetch + GitHub REST I/O and writes `.watcher/state.json` + snapshots; `.github/workflows/watch.yml` schedules it and commits state back. Defaults to dry-run when `GITHUB_TOKEN` is absent.

**Tech Stack:** TypeScript, `tsx`, `cheerio`, Node `fetch`/`crypto`, GitHub REST API, vitest.

Spec: `docs/superpowers/specs/2026-06-18-milestone-2-watcher-design.md`. Root: `overdue-ai`.

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | add `tsx`, `cheerio` to `devDependencies` |
| `src/watcher/core.ts` | PURE: `extractText`, `hashText`, `diffSummary`, `isMeaningfulChange`, `dueDeadlines`, `issueMarker` |
| `tests/watch.test.ts` | vitest over the pure core |
| `.watcher/watchlist.json` | curated server-rendered sources |
| `.watcher/state.json` | `{ id: { hash, lastChanged } }` (seeded `{}`) |
| `.watcher/snapshots/.gitkeep` | snapshot dir (text files written at run time) |
| `scripts/watch.ts` | runner: fetch + GitHub API + state/snapshot writes + dry-run |
| `.github/workflows/watch.yml` | weekly + manual; commits state back |
| `.github/workflows/deploy.yml` | add `paths-ignore` (no rebuild loop from human commits) |

---

## Task 1: Pure core + tests (TDD)

**Files:** Create `src/watcher/core.ts`, `tests/watch.test.ts`; Modify `package.json`.

- [ ] **Step 1: Add dev deps**

```bash
cd overdue-ai && npm install -D tsx@^4 cheerio@^1 @types/node@^22
```
Then add a `watch` script to `package.json` `scripts`: `"watch": "tsx scripts/watch.ts"`.
Expected: devDependencies include `tsx`, `cheerio`, `@types/node`; the `watch` script exists; `package-lock.json` updated. (`@types/node` lets `node:crypto`/`node:fs` and the runner type-check cleanly; the `watch` script avoids `npm exec` arg-passing ambiguity.)

- [ ] **Step 2: Write the failing tests** — `tests/watch.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { extractText, hashText, diffSummary, isMeaningfulChange, dueDeadlines, issueMarker } from '../src/watcher/core';
import type { Commitment } from '../src/lib/types';

const NOW = Date.UTC(2026, 5, 18); // 2026-06-18

function c(over: Partial<Commitment>): Commitment {
  return {
    id: 'x', lab: 'OpenAI', track: 'lab', title: 't', description: 'd', category: 'governance',
    committedOn: '2024-01-01', deadlineType: 'calendar', deadline: '2026-06-25',
    resolution: null, resolvedOn: null, evidenceUrl: 'https://example.com', sourceLabel: 'S',
    ...over,
  };
}

describe('extractText', () => {
  it('strips script/style/head and collapses whitespace', () => {
    const html = '<html><head><title>x</title></head><body><style>.a{}</style><h1>Hello</h1>\n\n  world<script>1</script></body></html>';
    expect(extractText(html)).toBe('Hello world');
  });
  it('honors per-source stripSelectors', () => {
    const html = '<body><p class="ts">updated 5m ago</p><p>Real content</p></body>';
    expect(extractText(html, ['.ts'])).toBe('Real content');
  });
});

describe('hashText', () => {
  it('is deterministic and differs on change', () => {
    expect(hashText('a')).toBe(hashText('a'));
    expect(hashText('a')).not.toBe(hashText('b'));
  });
});

describe('diffSummary / isMeaningfulChange', () => {
  it('reports added sentences and is empty when identical', () => {
    expect(diffSummary('One. Two.', 'One. Two.').changedLines).toBe(0);
    const d = diffSummary('One. Two.', 'One. Two. Three is new.');
    expect(d.changedLines).toBe(1);
    expect(d.snippet).toContain('Three is new');
  });
  it('thresholds trivial changes', () => {
    expect(isMeaningfulChange({ changedLines: 1, snippet: '' }, 3)).toBe(false);
    expect(isMeaningfulChange({ changedLines: 4, snippet: '' }, 3)).toBe(true);
  });
});

describe('dueDeadlines', () => {
  it('includes unresolved lab rows within +30d / -14d, excludes the rest', () => {
    const list = [
      c({ id: 'soon', deadline: '2026-06-25' }),                       // +7 upcoming
      c({ id: 'justpast', deadline: '2026-06-10' }),                   // -8 overdue
      c({ id: 'far', deadline: '2026-12-01' }),                        // far future -> excluded
      c({ id: 'old', deadline: '2026-01-01' }),                        // long past -> excluded
      c({ id: 'resolved', deadline: '2026-06-25', resolution: 'met', resolvedOn: '2026-06-01' }), // excluded
      c({ id: 'reg', track: 'regulatory', deadline: '2026-06-25' }),   // excluded
      c({ id: 'trig', deadlineType: 'trigger', deadline: null }),      // excluded
    ];
    const ids = dueDeadlines(list, NOW).map((d) => d.c.id).sort();
    expect(ids).toEqual(['justpast', 'soon']);
  });
  it('agrees with computeStatus on a same-day deadline regardless of time of day', () => {
    const sameDay = c({ id: 'today', deadline: '2026-06-18' });
    const afternoon = Date.UTC(2026, 5, 18, 15); // 3pm UTC; deadline is midnight today, already passed
    const [d] = dueDeadlines([sameDay], afternoon);
    expect(d.kind).toBe('overdue'); // matches computeStatus, not a spurious "upcoming 0 days"
  });
});

describe('issueMarker', () => {
  it('is stable and namespaced', () => {
    expect(issueMarker('src', 'anthropic-rsp')).toBe('<!-- watcher:src:anthropic-rsp -->');
    expect(issueMarker('deadline', 'openai-x')).toBe('<!-- watcher:deadline:openai-x -->');
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `npm test -- watch`
Expected: FAIL ("Cannot find module '../src/watcher/core'").

- [ ] **Step 4: Implement `src/watcher/core.ts`**

```ts
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { Commitment } from '../lib/types';
import { parseUTC, DAY_MS, computeStatus } from '../lib/status';

/** Visible text only: drop script/style/head/noscript (+ per-source selectors), collapse whitespace. */
export function extractText(html: string, stripSelectors: string[] = []): string {
  const $ = cheerio.load(html);
  $('script, style, head, noscript').remove();
  for (const sel of stripSelectors) $(sel).remove();
  const body = $('body');
  const text = (body.length ? body.text() : $.root().text()) || '';
  return text.replace(/\s+/g, ' ').trim();
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export interface DiffResult { changedLines: number; snippet: string; }

/** Sentence-level "what's new": chunks present in `next` but not in `prev`. */
export function diffSummary(prev: string, next: string, maxLines = 20): DiffResult {
  const split = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const prevSet = new Set(split(prev));
  const added = split(next).filter((s) => !prevSet.has(s));
  return { changedLines: added.length, snippet: added.slice(0, maxLines).join('\n') };
}

export function isMeaningfulChange(diff: DiffResult, threshold = 3): boolean {
  return diff.changedLines >= threshold;
}

export type DueKind = 'overdue' | 'upcoming';
export interface DueItem { c: Commitment; kind: DueKind; days: number; }

export function dueDeadlines(commitments: Commitment[], now: number, withinDays = 30, graceDays = 14): DueItem[] {
  const out: DueItem[] = [];
  for (const c of commitments) {
    if (c.track !== 'lab' || c.resolution !== null || c.deadlineType !== 'calendar' || !c.deadline) continue;
    const rawDays = (parseUTC(c.deadline) - now) / DAY_MS;
    const status = computeStatus(c, now); // 'upcoming' | 'overdue' — the SAME rule the board uses, so kind never disagrees
    if (status === 'upcoming') {
      const days = Math.ceil(rawDays);
      if (days <= withinDays) out.push({ c, kind: 'upcoming', days });
    } else if (status === 'overdue') {
      const days = Math.floor(-rawDays);
      if (days <= graceDays) out.push({ c, kind: 'overdue', days });
    }
  }
  return out;
}

export function issueMarker(kind: 'src' | 'deadline', id: string): string {
  return `<!-- watcher:${kind}:${id} -->`;
}
```

- [ ] **Step 5: Run — verify pass**

Run: `npm test -- watch`
Expected: PASS (all watch tests).

- [ ] **Step 6: Commit**

```bash
git -C overdue-ai add package.json package-lock.json src/watcher/core.ts tests/watch.test.ts
git -C overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "feat(watcher): pure core (extract/hash/diff/dueDeadlines) + tests + tsx/cheerio deps"
```

---

## Task 2: Watchlist + state scaffolding

**Files:** Create `.watcher/watchlist.json`, `.watcher/state.json`, `.watcher/snapshots/.gitkeep`.

- [ ] **Step 1: Create `.watcher/watchlist.json`** (server-rendered sources only — no SPAs)

```json
[
  { "id": "anthropic-rsp", "label": "Anthropic — RSP updates", "url": "https://www.anthropic.com/rsp-updates" },
  { "id": "openai-preparedness", "label": "OpenAI — Preparedness Framework", "url": "https://openai.com/index/updating-our-preparedness-framework/" },
  { "id": "deepmind-fsf", "label": "Google DeepMind — Frontier Safety Framework", "url": "https://deepmind.google/about/responsibility-safety/" },
  { "id": "metr-fsp", "label": "METR — Frontier AI Safety Policies index", "url": "https://metr.org/faisc" },
  { "id": "eu-ai-act-timeline", "label": "EU AI Act — implementation timeline", "url": "https://artificialintelligenceact.eu/implementation-timeline/" }
]
```
> Note: URLs are seeds — Task 4 verifies each returns server-rendered HTML (non-empty `extractText`) before relying on it; swap/drop any that are JS shells. Keep the list small (5) for v1; grow later.

- [ ] **Step 2: Seed `.watcher/state.json`**

```json
{}
```

- [ ] **Step 3: Create the snapshot dir**

```bash
mkdir -p overdue-ai/.watcher/snapshots && touch overdue-ai/.watcher/snapshots/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git -C overdue-ai add .watcher/
git -C overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "feat(watcher): watchlist + empty state scaffolding"
```

---

## Task 3: The runner `scripts/watch.ts`

**Files:** Create `scripts/watch.ts`.

- [ ] **Step 1: Write `scripts/watch.ts`**

```ts
/**
 * Watcher runner. Two checks → deduped GitHub issues. Writes .watcher state+snapshots.
 * Dry-run (no API/file writes) when --dry-run/WATCHER_DRY_RUN or GITHUB_TOKEN absent (unless --ci).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText, hashText, diffSummary, isMeaningfulChange, dueDeadlines, issueMarker } from '../src/watcher/core';
import { computeStatus } from '../src/lib/status';
import { COMMITMENTS } from '../src/data/commitments';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY ?? 'kayadibi1/overdue-ai';
const CI = args.has('--ci');
const DRY = args.has('--dry-run') || process.env.WATCHER_DRY_RUN === '1' || (!token && !CI);
if (!token && CI) { console.error('GITHUB_TOKEN required in --ci mode'); process.exit(1); }
const now = Date.now();

type Watch = { id: string; label: string; url: string; stripSelectors?: string[] };
type State = Record<string, { hash: string; lastChanged: string }>;
const W = (p: string) => resolve(ROOT, p);
const watchlist: Watch[] = JSON.parse(readFileSync(W('.watcher/watchlist.json'), 'utf8'));
const state: State = JSON.parse(readFileSync(W('.watcher/state.json'), 'utf8'));
const today = new Date(now).toISOString().slice(0, 10);

interface Planned { marker: string; title: string; body: string; }
const planned: Planned[] = [];
const pendingSnapshots = new Map<string, string>();   // flushed to disk only after all issues succeed

async function fetchText(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'overdue-watcher' } });
      if (!res.ok) { if (res.status >= 500 && attempt === 0) continue; return null; }
      if (Number(res.headers.get('content-length') ?? '0') > 2_000_000) return null; // reject oversized early when advertised
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 2_000_000) return null;                                     // hard cap if length absent/wrong
      return new TextDecoder().decode(buf);
    } catch { if (attempt === 0) continue; return null; }
  }
  return null;
}

function snapPath(id: string) { return W(`.watcher/snapshots/${id}.txt`); }

async function checkSources() {
  for (const w of watchlist) {
    const html = await fetchText(w.url);
    if (html == null) { console.warn(`skip (fetch failed): ${w.id}`); continue; }
    const text = extractText(html, w.stripSelectors).slice(0, 100_000); // 100 KB cap
    const hash = hashText(text);
    const prior = state[w.id];
    if (!prior) {                                  // baseline: record, no issue
      pendingSnapshots.set(w.id, text);
      state[w.id] = { hash, lastChanged: today };
      console.log(`baseline: ${w.id}`);
      continue;
    }
    if (prior.hash === hash) { console.log(`unchanged: ${w.id}`); continue; }
    const prev = existsSync(snapPath(w.id)) ? readFileSync(snapPath(w.id), 'utf8') : '';
    const diff = diffSummary(prev, text);
    if (!isMeaningfulChange(diff)) { // sub-threshold: refresh silently
      pendingSnapshots.set(w.id, text);
      state[w.id] = { hash, lastChanged: today };
      console.log(`minor change (no issue): ${w.id}`);
      continue;
    }
    planned.push({
      marker: issueMarker('src', w.id),
      title: `Source changed: ${w.label}`,
      body: `${issueMarker('src', w.id)}\n\n**${w.label}** changed (detected ${today}).\n${w.url}\n\nNew/changed text:\n\n> ${diff.snippet.replace(/\n/g, '\n> ')}\n\nReview and update \`src/data/commitments.ts\` if warranted.`,
    });
    pendingSnapshots.set(w.id, text);
    state[w.id] = { hash, lastChanged: today };
  }
}

function checkDeadlines() {
  for (const d of dueDeadlines(COMMITMENTS, now)) {
    const status = computeStatus(d.c, now);
    planned.push({
      marker: issueMarker('deadline', d.c.id),
      title: `Deadline check: ${d.c.title}`,
      body: `${issueMarker('deadline', d.c.id)}\n\n**${d.c.lab} — ${d.c.title}**\nDeadline: ${d.c.deadline} (${d.kind}, ${d.days}d; computed status: ${status}).\nSource: ${d.c.evidenceUrl}\n\nVerify and set \`resolution\` in \`src/data/commitments.ts\`.`,
    });
  }
}

// ---- GitHub REST ----
const api = (path: string, init?: RequestInit) =>
  fetch(`https://api.github.com${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'overdue-watcher', ...(init?.headers ?? {}) } });

async function ensureLabel() {
  const res = await api(`/repos/${repo}/labels`, { method: 'POST', body: JSON.stringify({ name: 'watcher', color: 'd92d20', description: 'Automated review item' }) });
  if (!res.ok && res.status !== 422) throw new Error(`label create failed: ${res.status}`); // 422 = already exists
}

async function openWatcherIssues(): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  for (let page = 1; ; page++) {
    const res = await api(`/repos/${repo}/issues?labels=watcher&state=open&per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`list issues failed: ${res.status}`);
    const items: Array<{ number: number; body: string | null }> = await res.json();
    for (const it of items) {
      const m = (it.body ?? '').match(/<!-- (watcher:[a-z]+:[^>]+?) -->/);
      if (m) found.set(`<!-- ${m[1]} -->`, it.number);
    }
    if (items.length < 100) break;
  }
  return found;
}

async function upsert(open: Map<string, number>, p: Planned) {
  const existing = open.get(p.marker);
  const res = existing
    ? await api(`/repos/${repo}/issues/${existing}`, { method: 'PATCH', body: JSON.stringify({ body: p.body }) })
    : await api(`/repos/${repo}/issues`, { method: 'POST', body: JSON.stringify({ title: p.title, body: p.body, labels: ['watcher'] }) });
  if (!res.ok) throw new Error(`issue ${existing ? 'update' : 'create'} failed (${res.status}): ${p.title}`); // throw → run fails BEFORE state is persisted
  console.log(`${existing ? 'updated #' + existing : 'created'}: ${p.title}`);
}

async function main() {
  await checkSources();   // updates `state` + `pendingSnapshots` IN MEMORY only
  checkDeadlines();
  console.log(`\n${planned.length} issue(s) planned; dryRun=${DRY}`);
  if (DRY) { for (const p of planned) console.log(`  • ${p.title}`); return; }
  // Create/refresh issues FIRST. upsert() throws on any API failure, so a failed
  // call can never let us persist state (mark a source "seen") without its issue.
  await ensureLabel();
  const open = await openWatcherIssues();
  for (const p of planned) await upsert(open, p);
  // Only now flush state + snapshots to disk for the workflow to commit.
  mkdirSync(W('.watcher/snapshots'), { recursive: true });
  for (const [id, text] of pendingSnapshots) writeFileSync(snapPath(id), text);
  writeFileSync(W('.watcher/state.json'), JSON.stringify(state, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Local dry-run**

Run: `cd overdue-ai && npm run watch -- --dry-run`
Expected: it fetches the watchlist, prints `baseline:` for each source (first run), prints any `Deadline check:` planned issues for genuinely-due commitments, and `dryRun=true` with no API calls or file writes. (If a source fetch fails or returns a JS shell with near-empty text, note it — that source should be swapped/dropped in Task 4.)

- [ ] **Step 3: Commit**

```bash
git -C overdue-ai add scripts/watch.ts
git -C overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "feat(watcher): runner (fetch + diff + GitHub issues + dry-run)"
```

---

## Task 4: Workflow + deploy paths-ignore

**Files:** Create `.github/workflows/watch.yml`; Modify `.github/workflows/deploy.yml`.

- [ ] **Step 1: Write `.github/workflows/watch.yml`**

```yaml
name: Watcher
on:
  workflow_dispatch: {}
  schedule:
    - cron: '17 9 * * 1'   # Mondays 09:17 UTC
permissions:
  contents: write
  issues: write
concurrency:
  group: watcher-state-main
  cancel-in-progress: false
jobs:
  watch:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run watch -- --ci
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
      - name: Commit state if changed
        run: |
          if [ -n "$(git status --porcelain .watcher)" ]; then
            git config user.name 'overdue-watcher'
            git config user.email 'actions@github.com'
            git add .watcher
            git commit -m 'chore(watcher): update state [skip ci]'
            git pull --rebase origin main || true
            git push origin HEAD:main || (git pull --rebase origin main && git push origin HEAD:main)
          else
            echo "no state change"
          fi
```

- [ ] **Step 2: Add `paths-ignore` to `deploy.yml`**

Change the `push` trigger so watcher/doc commits don't rebuild the site. Replace:

```yaml
on:
  push: { branches: [main] }
  workflow_dispatch:
```
with:

```yaml
on:
  push:
    branches: [main]
    paths-ignore: ['.watcher/**', 'docs/**', '**.md']
  workflow_dispatch:
```

- [ ] **Step 3: Commit**

```bash
git -C overdue-ai add .github/workflows/watch.yml .github/workflows/deploy.yml
git -C overdue-ai -c user.name='kayadibi1' -c user.email='sidarvig@gmail.com' commit -m "ci(watcher): weekly workflow + deploy paths-ignore"
```

---

## Task 5: Verify, publish, trigger

- [ ] **Step 1: Full test**

Run: `cd overdue-ai && npm test && npm run build`
Expected: all tests pass (incl. `watch.test.ts`); build Complete (the watcher doesn't touch the site, so build is unaffected).

- [ ] **Step 2: Validate the watchlist URLs (dry-run)**

Run: `npm run watch -- --dry-run`
For each source, confirm `extractText` produced substantive text (not a ~empty JS shell). Edit `.watcher/watchlist.json` to drop/replace any SPA/dead URL, re-run, then commit any watchlist change.

- [ ] **Step 3: Push**

```bash
git -C overdue-ai push origin main
```
Confirm the **deploy** workflow does NOT run for these commits (paths-ignore covers `.github/**`? No — workflow files are under `.github/`; the deploy push trigger still fires for non-ignored paths like `scripts/`, `src/`, `package.json`). Expect a deploy run (harmless — site rebuilds, unchanged). The *watcher's own* future state commits (touching only `.watcher/`) will be skipped by paths-ignore.

- [ ] **Step 4: Trigger the watcher manually**

```bash
gh workflow run watch.yml -R kayadibi1/overdue-ai
gh run watch -R kayadibi1/overdue-ai $(gh run list -R kayadibi1/overdue-ai --workflow watch.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```
Expected: green run. First run establishes source baselines (no "Source changed" issues) and **opens "Deadline check:" issues** for genuinely-due unresolved commitments, labeled `watcher`. A `.watcher/state.json` commit appears (with snapshots), and does NOT trigger a deploy.

- [ ] **Step 5: Confirm + re-run idempotency**

```bash
gh issue list -R kayadibi1/overdue-ai --label watcher
gh workflow run watch.yml -R kayadibi1/overdue-ai   # second run
```
Expected: the second run does not duplicate issues (dedupe by marker); sources now read `unchanged`.
