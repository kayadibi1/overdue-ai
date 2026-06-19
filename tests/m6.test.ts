import { describe, it, expect } from 'vitest';
import { labSlug, labFromSlug, keptRate } from '../src/lib/labs';
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
