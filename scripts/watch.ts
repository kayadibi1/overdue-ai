/**
 * Watcher runner. Two checks → deduped GitHub issues. Writes .watcher state+snapshots.
 * Dry-run (no API/file writes) when --dry-run/WATCHER_DRY_RUN or GITHUB_TOKEN absent (unless --ci).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText, hashText, diffSummary, isMeaningfulChange, dueDeadlines, issueMarker, fetchHtml } from '../src/watcher/core';
import { runChecks } from '../src/watcher/checks';
import { fetchVerifiable } from '../src/watcher/verify-fetch';
import { archive } from '../src/watcher/wayback';
import { mergeVerification } from '../src/watcher/merge';
import { parseVerification } from '../src/lib/verify/schema';
import { computeStatus } from '../src/lib/status';
import { primarySource } from '../src/lib/sources';
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
const pendingSnapshots = new Map<string, string>(); // flushed to disk only after all issues succeed

function snapPath(id: string) { return W(`.watcher/snapshots/${id}.txt`); }

async function checkSources() {
  for (const w of watchlist) {
    const html = await fetchHtml(w.url);
    if (html == null) { console.warn(`skip (fetch failed): ${w.id}`); continue; }
    const text = extractText(html, w.stripSelectors).slice(0, 100_000); // 100 KB cap
    const hash = hashText(text);
    const prior = state[w.id];
    if (!prior) {                                  // baseline: record, no issue
      pendingSnapshots.set(w.id, text);
      state[w.id] = { hash, lastChanged: today };
      console.log(`baseline: ${w.id} (${text.length} chars)`);
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
      body: `${issueMarker('deadline', d.c.id)}\n\n**${d.c.lab} — ${d.c.title}**\nDeadline: ${d.c.deadline} (${d.kind}, ${d.days}d; computed status: ${status}).\nSource: ${primarySource(d.c).url}\n\nVerify and set \`resolution\` in \`src/data/commitments.ts\`.`,
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

  // ---- Verification checks → rides along in `planned`; writes verification.json behind a guard ----
  // Prior state (missing/bad file → empty), then run the checks and merge over it.
  let prevState;
  try { prevState = parseVerification(JSON.parse(readFileSync(resolve(ROOT, 'src/data/verification.json'), 'utf8'))); }
  catch { prevState = { rows: {} }; }
  const { issues, rows } = await runChecks(COMMITMENTS, prevState.rows, now, fetchVerifiable);
  for (const it of issues) planned.push(it);                 // already {marker,title,body}

  // ---- Capped Wayback archive pass: archive un-archived OBLIGATION sources ----
  // Build a worklist of obligation sources whose computed row has no archiveUrl yet,
  // then archive at most ARCHIVE_CAP per run (politely, 5s apart). Skipped in DRY.
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const ARCHIVE_CAP = 10;
  if (DRY) {
    console.log('skip archiving (dry-run)');
  } else {
    const auth = process.env.IA_ACCESS_KEY && process.env.IA_SECRET_KEY
      ? `LOW ${process.env.IA_ACCESS_KEY}:${process.env.IA_SECRET_KEY}`
      : undefined;
    type Job = { id: string; k: number; url: string };
    const worklist: Job[] = [];
    for (const c of COMMITMENTS) {
      const row = rows[c.id];
      if (!row) continue;
      for (let i = 0; i < c.sources.length; i++) {
        if (c.sources[i].role !== 'obligation') continue;
        const k = row.sources.findIndex((rs) => rs.url === c.sources[i].url);
        if (k < 0) continue;
        if (row.sources[k].archiveUrl === undefined) worklist.push({ id: c.id, k, url: c.sources[i].url });
      }
    }
    const toRun = worklist.slice(0, ARCHIVE_CAP);
    const deferred = worklist.length - toRun.length;
    console.log(`archiving ${toRun.length} obligation source(s); ${deferred} deferred to a later run`);
    for (let n = 0; n < toRun.length; n++) {
      const job = toRun[n];
      if (n > 0) await sleep(5000); // be polite to Save-Page-Now
      const result = await archive(job.url, { auth });
      if (result.url) rows[job.id].sources[job.k].archiveUrl = result.url;
      console.log(`archive ${job.id} [${job.url}] → ${result.url ?? `(none) ${result.note ?? ''}`.trim()}`);
    }
  }

  const { next, changed } = mergeVerification(prevState, rows, today);
  // Validate `next` round-trips before any write: corruption drops row keys → refuse + flag.
  const valid = parseVerification(next);
  const validates = Object.keys(valid.rows).length === Object.keys(next.rows).length;
  if (!validates) {
    planned.push({
      marker: issueMarker('stale', 'verification-json'),
      title: 'verification.json failed validation',
      body: `${issueMarker('stale', 'verification-json')}\n\nThe freshly-computed verification state did not round-trip through \`parseVerification\` (row keys dropped). The file was NOT written. Inspect \`src/watcher/checks.ts\` / \`merge.ts\` output.`,
    });
  }
  if (DRY) {
    console.log(`verification: would write (changed=${changed}, validates=${validates})`);
  } else if (!validates) {
    console.log('verification: validation refused — verification.json NOT written');
  } else if (changed) {
    writeFileSync(resolve(ROOT, 'src/data/verification.json'), JSON.stringify(next, null, 2) + '\n');
    console.log('verification: wrote verification.json');
  } else {
    console.log('verification: no verification change');
  }

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
