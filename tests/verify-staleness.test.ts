import { describe, it, expect } from 'vitest';
import { isStale, STALE_DAYS } from '../src/lib/verify/staleness';

const NOW = Date.parse('2026-06-19');

describe('isStale', () => {
  it('exposes the 30/180 day thresholds', () => {
    expect(STALE_DAYS.volatile).toBe(30);
    expect(STALE_DAYS.settled).toBe(180);
  });

  it('contested row reviewed 2026-05-01 is stale (age > 30)', () => {
    const c = { contested: true, resolution: null, reviewedOn: '2026-05-01' } as any;
    expect(isStale(c, NOW)).toBe(true);
  });

  it('contested row reviewed 2026-06-10 is fresh (age < 30)', () => {
    const c = { contested: true, resolution: null, reviewedOn: '2026-06-10' } as any;
    expect(isStale(c, NOW)).toBe(false);
  });

  it("resolved 'met' row reviewed 2025-12-01 is stale (age > 180)", () => {
    const c = { contested: false, resolution: 'met', reviewedOn: '2025-12-01' } as any;
    expect(isStale(c, NOW)).toBe(true);
  });

  it("resolved 'met' row reviewed 2026-05-01 is fresh (age < 180)", () => {
    const c = { contested: false, resolution: 'met', reviewedOn: '2026-05-01' } as any;
    expect(isStale(c, NOW)).toBe(false);
  });

  it('row with no reviewedOn is stale', () => {
    const c = { contested: false, resolution: 'met', reviewedOn: null } as any;
    expect(isStale(c, NOW)).toBe(true);
  });
});
