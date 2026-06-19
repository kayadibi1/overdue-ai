import { describe, it, expect } from 'vitest';
import { computeStatus, parseUTC } from '../src/lib/status';
import type { Commitment } from '../src/lib/types';

const NOW = Date.UTC(2026, 5, 18); // 2026-06-18

function make(over: Partial<Commitment>): Commitment {
  return {
    id: 'x', lab: 'OpenAI', track: 'lab', title: 't', description: 'd', category: 'governance',
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
  it('labels a resolved trigger commitment (no deadline) by its resolved date', () => {
    const r = relativeTime(make({ resolution: 'missed', deadlineType: 'trigger', deadline: null, resolvedOn: '2024-05-17' }), NOW);
    expect(r).toEqual({ label: 'resolved 2024-05-17', kind: 'resolved', days: 0 });
  });
  it('shows "resolved N days early" and "resolved on time"', () => {
    expect(relativeTime(make({ resolution: 'met', deadline: '2025-02-10', resolvedOn: '2025-02-03' }), NOW))
      .toEqual({ label: 'resolved 7 days early', kind: 'resolved', days: -7 });
    expect(relativeTime(make({ resolution: 'met', deadline: '2025-02-10', resolvedOn: '2025-02-10' }), NOW))
      .toEqual({ label: 'resolved on time', kind: 'resolved', days: 0 });
  });
});

import { summarize, sortByUrgency } from '../src/lib/status';

describe('summarize', () => {
  it('counts commitments by computed status', () => {
    const list = [
      make({ resolution: 'met' }),
      make({ resolution: 'missed' }),
      make({ deadline: '2025-01-01' }),       // overdue
      make({ deadline: '2026-12-01' }),       // upcoming
      make({ deadlineType: 'trigger', deadline: null }), // pending
    ];
    expect(summarize(list, NOW)).toEqual({ met: 1, missed: 1, partial: 0, overdue: 1, upcoming: 1, pending: 1 });
  });
});

describe('sortByUrgency', () => {
  it('orders overdue→upcoming→pending→resolved, most-overdue first, soonest-upcoming first', () => {
    const met = make({ id: 'met', resolution: 'met' });
    const pending = make({ id: 'pending', deadlineType: 'trigger', deadline: null });
    const overdueSmall = make({ id: 'od-small', deadline: '2026-06-10' });   // 8 days
    const overdueBig = make({ id: 'od-big', deadline: '2025-01-01' });       // ~533 days
    const upSoon = make({ id: 'up-soon', deadline: '2026-06-20' });          // 2 days
    const upLate = make({ id: 'up-late', deadline: '2027-01-01' });
    const sorted = sortByUrgency([met, pending, overdueSmall, overdueBig, upSoon, upLate], NOW).map(c => c.id);
    expect(sorted).toEqual(['od-big', 'od-small', 'up-soon', 'up-late', 'pending', 'met']);
  });
  it('deterministically orders resolved trigger rows (no deadline) by resolvedOn desc then id', () => {
    const a = make({ id: 'a', resolution: 'met', deadlineType: 'trigger', deadline: null, resolvedOn: '2024-01-01' });
    const b = make({ id: 'b', resolution: 'met', deadlineType: 'trigger', deadline: null, resolvedOn: '2025-01-01' });
    expect(sortByUrgency([a, b], NOW).map((c) => c.id)).toEqual(['b', 'a']);
    expect(sortByUrgency([b, a], NOW).map((c) => c.id)).toEqual(['b', 'a']); // order-independent (no NaN comparator)
  });
});

import { regulatoryLabel } from '../src/lib/status';

describe('regulatoryLabel', () => {
  const NOW2 = Date.UTC(2026, 5, 18); // 2026-06-18
  it('counts down to a future statutory date (upcoming, never overdue)', () => {
    expect(regulatoryLabel('2026-08-02', NOW2)).toEqual({ label: 'in 45 days', kind: 'upcoming', days: 45 });
  });
  it('shows "in force since" once the date has passed (never "overdue")', () => {
    const r = regulatoryLabel('2025-08-02', NOW2);
    expect(r.kind).toBe('inforce');
    expect(r.label).toBe('in force since 2025-08-02');
  });
  it('uses singular "in 1 day" at the boundary', () => {
    expect(regulatoryLabel('2026-06-19', NOW2).label).toBe('in 1 day');
  });
});
