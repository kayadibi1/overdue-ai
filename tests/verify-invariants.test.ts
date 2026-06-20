import { describe, it, expect } from 'vitest';
import type { Source } from '../src/lib/types';
import { primarySource } from '../src/lib/sources';
import { checkInvariants } from '../src/lib/verify/invariants';

const base = {
  id: 'x', lab: 'OpenAI', track: 'lab', title: 't', description: 'd', category: 'governance',
  committedOn: '2025-01-01', deadlineType: 'calendar', deadline: '2025-02-01', resolution: null, resolvedOn: null,
  sources: [{ url: 'u', label: 'l', tier: 'primary', role: 'obligation', quote: 'q' }],
} as any;

describe('Source type', () => {
  it('accepts a full obligation source', () => {
    const s: Source = { url: 'u', label: 'l', tier: 'primary', role: 'obligation', quote: 'q' };
    expect(s.role).toBe('obligation');
  });
});

describe('primarySource', () => {
  it('returns the obligation source when present', () => {
    const c = {
      ...base,
      sources: [
        { url: 'a', label: 'a', tier: 'secondary', role: 'context' },
        { url: 'b', label: 'b', tier: 'primary', role: 'obligation', quote: 'q' },
      ],
    } as any;
    expect(primarySource(c).url).toBe('b');
  });

  it('falls back to sources[0] when no obligation source', () => {
    const c = {
      ...base,
      sources: [
        { url: 'a', label: 'a', tier: 'secondary', role: 'context' },
        { url: 'b', label: 'b', tier: 'primary', role: 'fulfillment' },
      ],
    } as any;
    expect(primarySource(c).url).toBe('a');
  });
});

describe('checkInvariants', () => {
  it('returns [] for a clean row', () => {
    expect(checkInvariants(base)).toEqual([]);
  });

  it('flags an obligation source missing a quote', () => {
    const c = { ...base, sources: [{ url: 'u', label: 'l', tier: 'primary', role: 'obligation' }] } as any;
    const probs = checkInvariants(c);
    expect(probs.map((p) => p.rule)).toContain('obligation-quote');
  });

  it('flags a derived deadline with no derivationNote', () => {
    const c = { ...base, deadlineBasis: 'derived' } as any;
    const probs = checkInvariants(c);
    expect(probs.map((p) => p.rule)).toContain('derived-note');
  });

  it('does not flag a derived deadline that has a derivationNote', () => {
    const c = { ...base, deadlineBasis: 'derived', derivationNote: 'because' } as any;
    expect(checkInvariants(c).map((p) => p.rule)).not.toContain('derived-note');
  });

  it('flags a missed ruling with no reviewedBy', () => {
    const c = {
      ...base,
      resolution: 'missed',
      sources: [
        { url: 'a', label: 'a', tier: 'primary', role: 'obligation', quote: 'q' },
        { url: 'b', label: 'b', tier: 'secondary', role: 'context' },
      ],
    } as any;
    const probs = checkInvariants(c);
    expect(probs.map((p) => p.rule)).toContain('missed-signoff');
  });

  it('flags a missed ruling with <2 sources and no primary fulfillment', () => {
    const c = { ...base, resolution: 'missed', reviewedBy: 'sidar' } as any;
    const probs = checkInvariants(c);
    expect(probs.map((p) => p.rule)).toContain('missed-sourcing');
  });

  it('does not flag missed-sourcing when a primary fulfillment source exists', () => {
    const c = {
      ...base,
      resolution: 'missed',
      reviewedBy: 'sidar',
      sources: [{ url: 'u', label: 'l', tier: 'primary', role: 'fulfillment' }],
    } as any;
    expect(checkInvariants(c).map((p) => p.rule)).not.toContain('missed-sourcing');
  });

  it('does not flag missed-sourcing when there are >=2 sources', () => {
    const c = {
      ...base,
      resolution: 'missed',
      reviewedBy: 'sidar',
      sources: [
        { url: 'a', label: 'a', tier: 'primary', role: 'obligation', quote: 'q' },
        { url: 'b', label: 'b', tier: 'secondary', role: 'context' },
      ],
    } as any;
    expect(checkInvariants(c).map((p) => p.rule)).not.toContain('missed-sourcing');
  });
});
