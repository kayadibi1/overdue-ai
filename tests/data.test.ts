import { describe, it, expect } from 'vitest';
import { COMMITMENTS } from '../src/data/commitments';
import { LABS, CATEGORIES } from '../src/lib/types';
import { computeStatus } from '../src/lib/status';

const NOW = Date.UTC(2026, 5, 18);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe('COMMITMENTS dataset', () => {
  it('has at least 20 commitments', () => {
    expect(COMMITMENTS.length).toBeGreaterThanOrEqual(20);
  });
  it('every row passes schema rules', () => {
    for (const c of COMMITMENTS) {
      expect(c.id, c.id).toBeTruthy();
      expect(LABS).toContain(c.lab);
      expect(CATEGORIES).toContain(c.category);
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
    const ids = COMMITMENTS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('has >= 6 LIVE rows (overdue or upcoming) [objective-fit #1]', () => {
    const live = COMMITMENTS.filter(c => ['overdue', 'upcoming'].includes(computeStatus(c, NOW)));
    expect(live.length).toBeGreaterThanOrEqual(6);
  });
});
