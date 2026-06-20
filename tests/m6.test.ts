import { describe, it, expect } from 'vitest';
import { labSlug, labFromSlug, keptRate, commitmentsByLab } from '../src/lib/labs';
import { toCsv } from '../src/lib/csv';
import type { Commitment } from '../src/lib/types';

const c = (o: Partial<Commitment>): Commitment => ({
  id:'x', lab:'OpenAI', track:'lab', title:'t', description:'d', category:'governance',
  committedOn:'2025-01-01', deadlineType:'calendar', deadline:'2025-06-01',
  resolution:null, resolvedOn:null,
  sources:[{ url:'https://e', label:'S', tier:'primary', role:'obligation', quote:'q' }], ...o });

describe('labSlug', () => {
  it('lowercases + hyphenates, round-trips', () => {
    expect(labSlug('Google DeepMind')).toBe('google-deepmind');
    expect(labSlug('Multi-lab')).toBe('multi-lab');
    expect(labFromSlug('google-deepmind')).toBe('Google DeepMind');
    expect(labFromSlug('nope')).toBeNull();
  });
});

describe('commitmentsByLab', () => {
  it('groups lab-track rows by lab (insertion order) and excludes regulatory rows', () => {
    const m = commitmentsByLab([
      c({ id: 'a', lab: 'OpenAI', track: 'lab' }),
      c({ id: 'b', lab: 'OpenAI', track: 'lab' }),
      c({ id: 'c', lab: 'Anthropic', track: 'lab' }),
      c({ id: 'd', lab: 'Multi-lab', track: 'regulatory' }),
    ]);
    expect([...m.keys()]).toEqual(['OpenAI', 'Anthropic']);  // regulatory lab never gets a bucket
    expect(m.get('OpenAI')!.map((x) => x.id)).toEqual(['a', 'b']);
    expect(m.get('Anthropic')!.map((x) => x.id)).toEqual(['c']);
    expect(m.has('Multi-lab')).toBe(false);
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
