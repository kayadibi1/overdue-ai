import { describe, it, expect } from 'vitest';
import { COMMITMENTS } from '../src/data/commitments';
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
      expect(ISO.test(c.committedOn)).toBe(true);
      if (c.deadlineType === 'calendar') expect(ISO.test(c.deadline ?? '')).toBe(true);
      if (c.deadlineType === 'trigger') expect(c.triggerText).toBeTruthy();
      if (c.resolution) expect(ISO.test(c.resolvedOn ?? '')).toBe(true);
      expect(() => new URL(c.evidenceUrl)).not.toThrow();
      expect(c.sourceLabel).toBeTruthy();
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
