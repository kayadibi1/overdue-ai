import { describe, it, expect } from 'vitest';
import { computeStatus, parseUTC } from '../src/lib/status';
import type { Commitment } from '../src/lib/types';

const NOW = Date.UTC(2026, 5, 18); // 2026-06-18

function make(over: Partial<Commitment>): Commitment {
  return {
    id: 'x', lab: 'OpenAI', title: 't', description: 'd', category: 'governance',
    committedOn: '2024-01-01', deadlineType: 'calendar', deadline: '2024-06-01',
    resolution: null, resolvedOn: null, evidenceUrl: 'https://example.com', sourceLabel: 'Src',
    ...over,
  };
}

describe('computeStatus', () => {
  it('returns the human resolution when set (terminal)', () => {
    expect(computeStatus(make({ resolution: 'missed' }), NOW)).toBe('missed');
    expect(computeStatus(make({ resolution: 'met' }), NOW)).toBe('met');
    expect(computeStatus(make({ resolution: 'partial' }), NOW)).toBe('partial');
  });
  it('is upcoming when an unresolved calendar deadline is in the future', () => {
    expect(computeStatus(make({ deadline: '2026-09-01' }), NOW)).toBe('upcoming');
  });
  it('is overdue when an unresolved calendar deadline is in the past', () => {
    expect(computeStatus(make({ deadline: '2025-01-01' }), NOW)).toBe('overdue');
  });
  it('treats a deadline that is exactly today as overdue', () => {
    expect(computeStatus(make({ deadline: '2026-06-18' }), NOW)).toBe('overdue');
  });
  it('is pending for an unresolved trigger with no date', () => {
    expect(computeStatus(make({ deadlineType: 'trigger', deadline: null, triggerText: 'before ASL-3' }), NOW)).toBe('pending');
  });
});

import { relativeTime } from '../src/lib/status';

describe('relativeTime', () => {
  it('counts up for overdue (days since deadline)', () => {
    const r = relativeTime(make({ deadline: '2026-06-08' }), NOW);
    expect(r).toEqual({ label: '10 days overdue', kind: 'overdue', days: 10 });
  });
  it('counts down for upcoming (days until deadline)', () => {
    const r = relativeTime(make({ deadline: '2026-06-28' }), NOW);
    expect(r).toEqual({ label: 'in 10 days', kind: 'upcoming', days: 10 });
  });
  it('uses singular "1 day" at the boundary', () => {
    expect(relativeTime(make({ deadline: '2026-06-17' }), NOW)?.label).toBe('1 day overdue');
  });
  it('shows "resolved N days late" for a resolved, dated item', () => {
    const r = relativeTime(make({ resolution: 'missed', deadline: '2025-05-10', resolvedOn: '2025-05-13' }), NOW);
    expect(r).toEqual({ label: 'resolved 3 days late', kind: 'resolved', days: 3 });
  });
  it('says "due today" when the deadline is exactly today', () => {
    expect(relativeTime(make({ deadline: '2026-06-18' }), NOW)).toEqual({ label: 'due today', kind: 'overdue', days: 0 });
  });
  it('returns null for a pending trigger', () => {
    expect(relativeTime(make({ deadlineType: 'trigger', deadline: null, resolution: null }), NOW)).toBeNull();
  });
});
