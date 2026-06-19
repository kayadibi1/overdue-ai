import { describe, it, expect } from 'vitest';
import { labSlug, labFromSlug, keptRate } from '../src/lib/labs';
import { toCsv } from '../src/lib/csv';
import type { Commitment } from '../src/lib/types';

const c = (o: Partial<Commitment>): Commitment => ({
  id:'x', lab:'OpenAI', track:'lab', title:'t', description:'d', category:'governance',
  committedOn:'2025-01-01', deadlineType:'calendar', deadline:'2025-06-01',
  resolution:null, resolvedOn:null, evidenceUrl:'https://e', sourceLabel:'S', ...o });

describe('labSlug', () => {
  it('lowercases + hyphenates, round-trips', () => {
    expect(labSlug('Google DeepMind')).toBe('google-deepmind');
    expect(labSlug('Multi-lab')).toBe('multi-lab');
    expect(labFromSlug('google-deepmind')).toBe('Google DeepMind');
    expect(labFromSlug('nope')).toBeNull();
  });
});

describe('keptRate', () => {
  it('met / resolved among resolved only; null when none resolved', () => {
    const rows = [c({resolution:'met'}), c({resolution:'missed'}), c({resolution:'partial'}), c({resolution:null})];
    const r = keptRate(rows);
    expect(r.met).toBe(1); expect(r.resolved).toBe(3); expect(r.rate).toBeCloseTo(1/3);
    expect(keptRate([c({resolution:null})]).rate).toBeNull();
  });
});

describe('toCsv', () => {
  it('emits a header + escapes commas/quotes/newlines (RFC 4180)', () => {
    const out = toCsv([c({ id:'a', title:'has, comma "q"\nnl', resolution:'met' })]);
    const [header, row] = out.trim().split('\r\n');
    expect(header.startsWith('id,lab,track,title,')).toBe(true);
    expect(row).toContain('"has, comma ""q""\nnl"');
    expect(out.endsWith('\r\n')).toBe(true);
  });
});
