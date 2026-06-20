import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPrompt, parseVerdict, runClaude } from './lib/claude.mjs';

const DIST = resolve('dist/commitments.json');
const VERIF = resolve('src/data/verification.json');
const CAP = 5;
const PROBLEM = 'Class-B adjudication unavailable — needs manual adjudication';

function ensureRow(rows, id) {
  if (!rows[id]) rows[id] = { sources: [], problems: [], proposals: [] };
  if (!Array.isArray(rows[id].proposals)) rows[id].proposals = [];
  if (!Array.isArray(rows[id].problems)) rows[id].problems = [];
  return rows[id];
}

function pushProblem(rows, id) {
  const row = ensureRow(rows, id);
  if (!row.problems.includes(PROBLEM)) row.problems.push(PROBLEM);
}

async function fetchArtifact(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; OverdueBot/1.0; +https://overduetracker.org)' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.replace(/<[^>]+>/g, ' ');
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Wayback fallback: latest snapshot's text (tags stripped), or null. Never throws. Dependency-free. */
async function fetchSnapshot(url) {
  try {
    const avail = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!avail.ok) return null;
    const data = await avail.json();
    const snap = data?.archived_snapshots?.closest?.url;
    if (!snap) return null;
    const page = await fetch(snap, { signal: AbortSignal.timeout(20_000) });
    if (!page.ok) return null;
    const html = await page.text();
    return html.replace(/<[^>]+>/g, ' ');
  } catch {
    return null;
  }
}

async function main() {
  // Auth guard: don't hang local/dev runs on a missing token.
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    console.log('no Claude auth — skipping Class-B');
    process.exit(0);
  }

  if (!existsSync(DIST)) {
    console.log('dist/commitments.json missing — run npm run build first');
    process.exit(0);
  }

  let commitments = [];
  try {
    commitments = JSON.parse(readFileSync(DIST, 'utf8')).commitments || [];
  } catch {
    console.log('dist/commitments.json unreadable — run npm run build first');
    process.exit(0);
  }

  let state;
  try {
    state = JSON.parse(readFileSync(VERIF, 'utf8'));
    if (!state || typeof state !== 'object' || typeof state.rows !== 'object' || !state.rows) state = { rows: {} };
  } catch {
    state = { rows: {} };
  }
  const rows = state.rows;
  const before = JSON.stringify(state);

  const candidates = commitments.filter((c) => c.resolution == null && c.fulfillmentCheck);
  const batch = candidates.slice(0, CAP);
  if (candidates.length > CAP) {
    console.log(`${candidates.length} candidates; capping at ${CAP}. Deferring: ${candidates.slice(CAP).map((c) => c.id).join(', ')}`);
  }

  for (const c of batch) {
    const url = c.fulfillmentCheck?.url;
    let text = url ? await fetchArtifact(url) : null;
    let viaArchive = false;
    if (text == null && url) {
      // Live fetch failed/blocked — fall back to the latest Wayback snapshot before flagging.
      text = await fetchSnapshot(url);
      if (text != null) {
        viaArchive = true;
        console.log(`[${c.id}] live fetch failed for ${url} — using archived snapshot`);
      }
    }
    if (text == null) {
      console.log(`[${c.id}] fetch failed (live + archive) for ${url} — problem flagged`);
      pushProblem(rows, c.id);
      continue;
    }
    const prompt = buildPrompt(c, viaArchive ? `[verified against archived Wayback snapshot]\n${text}` : text);
    const r = await runClaude(prompt);
    if (!r.ok) {
      console.log(`[${c.id}] claude failed (${r.reason}) — problem flagged`);
      pushProblem(rows, c.id);
      continue;
    }
    const v = parseVerdict(r.raw);
    if (!v) {
      console.log(`[${c.id}] unparseable verdict — problem flagged`);
      pushProblem(rows, c.id);
      continue;
    }
    const row = ensureRow(rows, c.id);
    row.proposals.push({ kind: 'class-B', ...v, ...(viaArchive ? { via: 'archive' } : {}) });
    console.log(`[${c.id}] proposal: ${v.verdict}${viaArchive ? ' (via archive)' : ''}`);
  }

  const after = JSON.stringify(state);
  if (after !== before) {
    writeFileSync(VERIF, JSON.stringify(state, null, 2) + '\n');
    console.log('verification.json updated');
  } else {
    console.log('no changes — verification.json untouched');
  }
  process.exit(0);
}

main().catch((e) => {
  // Belt-and-suspenders: never throw out of the process.
  console.log(`adjudicate: unexpected error (${e?.message ?? e}) — exiting clean`);
  process.exit(0);
});
