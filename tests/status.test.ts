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
