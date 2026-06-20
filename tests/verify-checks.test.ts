import { describe, it, expect } from 'vitest';
import { runChecks, type FetchFn } from '../src/watcher/checks';
import type { Commitment } from '../src/lib/types';
import type { RowState } from '../src/lib/verify/schema';

const NOW = Date.UTC(2026, 5, 19); // 2026-06-19
const RECENT = '2026-06-15';       // within volatile staleness window → isStale=false

const QUOTE = 'we will publish our safety framework';

function c(over: Partial<Commitment>): Commitment {
  return {
    id: 'x', lab: 'OpenAI', track: 'lab', title: 't', description: 'd', category: 'governance',
    committedOn: '2024-01-01', deadlineType: 'calendar', deadline: '2026-06-25',
    resolution: 'met', resolvedOn: '2026-06-10', reviewedOn: RECENT, reviewedBy: 'sidar',
    sources: [{ url: 'https://example.com/a', label: 'S', tier: 'primary', role: 'obligation', quote: QUOTE }],
    ...over,
  };
}

// Fetch fns return VerifyFetch; extractText() turns text into visible text the classifier sees.
const htmlWithQuote: FetchFn = async () => ({ text: `<body><p>Foreword. ${QUOTE} by 2026.</p></body>`, via: 'live', dead: false });
const htmlWithoutQuote: FetchFn = async () => ({ text: `<body><p>Nothing relevant here at all.</p></body>`, via: 'live', dead: false });
const deadLink: FetchFn = async () => ({ text: null, via: 'none', dead: true });            // real 404/410
const blockedLink: FetchFn = async () => ({ text: null, via: 'none', dead: false });        // 403/timeout, could not verify
const archivedQuote: FetchFn = async () => ({ text: `<body><p>Foreword. ${QUOTE} by 2026.</p></body>`, via: 'archive', dead: false });

describe('runChecks', () => {
  it('present quote → quoteCheck "ok" and no drift problem', async () => {
    const { issues, rows } = await runChecks([c({})], {}, NOW, htmlWithQuote);
    expect(rows.x.sources[0].quoteCheck).toBe('ok');
    expect(rows.x.sources[0].linkOk).toBe(true);
    expect(rows.x.problems).toEqual([]);
    expect(issues).toEqual([]);
  });

  it('previously-ok now-absent quote → quoteCheck "drifted" + a problem + an issue', async () => {
    const prev: Record<string, RowState> = {
      x: { sources: [{ url: 'https://example.com/a', linkOk: true, quoteCheck: 'ok' }], problems: [] },
    };
    const { issues, rows } = await runChecks([c({})], prev, NOW, htmlWithoutQuote);
    expect(rows.x.sources[0].quoteCheck).toBe('drifted');
    expect(rows.x.problems).toContain('quote drifted: https://example.com/a');
    expect(issues).toHaveLength(1);
    expect(issues[0].marker).toBe('<!-- watcher:source:x -->');
    expect(issues[0].body).toContain('quote drifted');
  });

  it('absent quote with no prior → quoteCheck "inconclusive", no drift problem', async () => {
    const { rows } = await runChecks([c({})], {}, NOW, htmlWithoutQuote);
    expect(rows.x.sources[0].quoteCheck).toBe('inconclusive');
    expect(rows.x.problems).not.toContain('quote drifted: https://example.com/a');
  });

  it('dead link (404) → linkOk false + a "dead link (404)" problem + inconclusive quote', async () => {
    const { issues, rows } = await runChecks([c({})], {}, NOW, deadLink);
    expect(rows.x.sources[0].linkOk).toBe(false);
    expect(rows.x.sources[0].quoteCheck).toBe('inconclusive');
    expect(rows.x.problems).toContain('dead link (404): https://example.com/a');
    expect(issues).toHaveLength(1);
  });

  it('blocked link (403/timeout, not dead) → linkOk false + NO problem + inconclusive quote', async () => {
    const { issues, rows } = await runChecks([c({})], {}, NOW, blockedLink);
    expect(rows.x.sources[0].linkOk).toBe(false);
    expect(rows.x.sources[0].quoteCheck).toBe('inconclusive');
    expect(rows.x.problems).toEqual([]);                              // could not verify ≠ a problem
    expect(rows.x.problems.some((p) => p.includes('dead link'))).toBe(false);
    expect(issues).toEqual([]);                                       // no under-review flag
  });

  it('archived hit → quote checked normally against the snapshot text', async () => {
    const { rows } = await runChecks([c({})], {}, NOW, archivedQuote);
    expect(rows.x.sources[0].linkOk).toBe(true);
    expect(rows.x.sources[0].quoteCheck).toBe('ok');
    expect(rows.x.problems).toEqual([]);
  });

  it('carries forward archiveUrl and lastChangedOn from prev state', async () => {
    const prev: Record<string, RowState> = {
      x: {
        sources: [{ url: 'https://example.com/a', linkOk: true, quoteCheck: 'ok', archiveUrl: 'https://web.archive.org/x' }],
        problems: [], lastChangedOn: '2026-01-01',
      },
    };
    const { rows } = await runChecks([c({})], prev, NOW, htmlWithQuote);
    expect(rows.x.sources[0].archiveUrl).toBe('https://web.archive.org/x');
    expect(rows.x.lastChangedOn).toBe('2026-01-01');
  });

  it('unresolved row with url-exists fulfillmentCheck + absent artifact past deadline → "missed" proposal + fulfillment issue', async () => {
    const row = c({
      resolution: null,
      fulfillmentCheck: { type: 'url-exists', url: 'u', by: '2020-01-01' },
    });
    const { issues, rows } = await runChecks([row], {}, NOW, deadLink); // deadLink returns null → artifact absent
    expect(rows.x.proposals).toEqual([
      { kind: 'class-A', status: 'missed', evidence: 'no artifact at u by 2020-01-01' },
    ]);
    const fi = issues.find((i) => i.marker === '<!-- watcher:fulfillment:x -->');
    expect(fi).toBeDefined();
    expect(fi!.title).toBe('Fulfillment proposal: t');
    expect(fi!.body).toContain('missed');
    expect(fi!.body).toContain('no artifact at u by 2020-01-01');
    expect(fi!.body).toContain('automation never rules');
    // a proposal is NOT a problem
    expect(rows.x.problems).not.toContain('no artifact at u by 2020-01-01');
  });

  it('resolved row (resolution:"met") with a fulfillmentCheck → NO proposal (resolution short-circuits)', async () => {
    const row = c({
      resolution: 'met',
      fulfillmentCheck: { type: 'url-exists', url: 'u', by: '2020-01-01' },
    });
    const { issues, rows } = await runChecks([row], {}, NOW, deadLink);
    expect(rows.x.proposals).toBeUndefined();
    expect(issues.find((i) => i.marker === '<!-- watcher:fulfillment:x -->')).toBeUndefined();
  });
});
