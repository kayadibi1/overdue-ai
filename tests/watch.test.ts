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
