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

// Fetch fns return HTML; extractText() turns it into visible text the classifier sees.
const htmlWithQuote: FetchFn = async () => `<body><p>Foreword. ${QUOTE} by 2026.</p></body>`;
const htmlWithoutQuote: FetchFn = async () => `<body><p>Nothing relevant here at all.</p></body>`;
const deadLink: FetchFn = async () => null;

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

  it('dead link → linkOk false + a "dead link" problem + inconclusive quote', async () => {
    const { issues, rows } = await runChecks([c({})], {}, NOW, deadLink);
    expect(rows.x.sources[0].linkOk).toBe(false);
    expect(rows.x.sources[0].quoteCheck).toBe('inconclusive');
    expect(rows.x.problems).toContain('dead link: https://example.com/a');
    expect(issues).toHaveLength(1);
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
});
