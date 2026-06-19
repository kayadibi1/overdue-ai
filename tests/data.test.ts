import { describe, it, expect } from 'vitest';
import { COMMITMENTS } from '../src/data/commitments';
import { UPDATES } from '../src/data/updates';
import { LABS, CATEGORIES } from '../src/lib/types';
import { computeStatus } from '../src/lib/status';

const NOW = Date.UTC(2026, 5, 18);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TRACKS = ['lab', 'regulatory'];

const lab = () => COMMITMENTS.filter((c) => c.track === 'lab');
const regulatory = () => COMMITMENTS.filter((c) => c.track === 'regulatory');

describe('COMMITMENTS dataset', () => {
  it('every row passes schema rules', () => {
    for (const c of COMMITMENTS) {
      expect(c.id, c.id).toBeTruthy();
      expect(TRACKS, c.id).toContain(c.track);
      expect(LABS, c.id).toContain(c.lab);
      expect(CATEGORIES, c.id).toContain(c.category);
      expect(c.title && c.description).toBeTruthy();
      expect(isRealUtcDate(c.committedOn), c.id).toBe(true);
      if (c.deadlineType === 'calendar') expect(isRealUtcDate(c.deadline ?? ''), c.id).toBe(true);
      if (c.deadlineType === 'trigger') expect(c.triggerText).toBeTruthy();
      if (c.resolution) expect(isRealUtcDate(c.resolvedOn ?? ''), c.id).toBe(true);
      const u = new URL(c.evidenceUrl);
      expect(/^https?:$/.test(u.protocol), c.id).toBe(true);   // real http(s) URL, not foo:bar / mailto:
      expect(u.hostname.includes('.'), c.id).toBe(true);        // has a dotted hostname
      expect(c.sourceLabel).toBeTruthy();
    }
  });
  it('resolvedOn is set iff resolution is set, and falls on/after committedOn', () => {
    for (const c of COMMITMENTS) {
      expect(Boolean(c.resolvedOn), c.id).toBe(Boolean(c.resolution)); // no stray resolvedOn / no resolution w/o date
      if (c.resolvedOn) expect(c.resolvedOn >= c.committedOn, c.id).toBe(true); // lexicographic = chronological for YYYY-MM-DD
    }
  });
  it('has unique ids', () => {
    const ids = COMMITMENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('has >= 22 lab-track rows', () => {
    expect(lab().length).toBeGreaterThanOrEqual(22);
  });
  it('has >= 3 LIVE lab-track rows (overdue or upcoming)', () => {
    const live = lab().filter((c) => ['overdue', 'upcoming'].includes(computeStatus(c, NOW)));
    expect(live.length).toBeGreaterThanOrEqual(3);
  });
  it('regulatory rows are dated and unscored (no kept/broken resolution)', () => {
    for (const c of regulatory()) {
      expect(c.deadlineType, c.id).toBe('calendar');
      expect(ISO.test(c.deadline ?? ''), c.id).toBe(true);
      expect(c.resolution, c.id).toBeNull();
    }
  });
  it('contains both tracks (the partition is real)', () => {
    expect(lab().length).toBeGreaterThan(0);
    expect(regulatory().length).toBeGreaterThan(0);
  });
});

/** True when `iso` matches YYYY-MM-DD and is a real calendar date (rejects e.g. 2026-02-31). */
function isRealUtcDate(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

describe('M6 data-model fields', () => {
  it('every lastChecked (where present) is a real UTC date', () => {
    for (const c of COMMITMENTS) {
      if (c.lastChecked !== undefined) {
        expect(isRealUtcDate(c.lastChecked), c.id).toBe(true);
      }
    }
  });
  it('every UPDATES kind (where present) is update or correction', () => {
    for (const u of UPDATES) {
      if (u.kind !== undefined) {
        expect(['update', 'correction'], u.id).toContain(u.kind);
      }
    }
  });
});
