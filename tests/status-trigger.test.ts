import { describe, it, expect } from 'vitest';
import { computeStatus } from '../src/lib/status';
import type { Commitment } from '../src/lib/types';

const now = Date.parse('2026-06-19');
const trig = (over: Partial<Commitment>): Commitment =>
  ({ id: 't', lab: 'Anthropic', track: 'lab', title: 't', description: 'd', category: 'safety-framework',
     committedOn: '2023-09-19', deadlineType: 'trigger', deadline: null, resolution: null, resolvedOn: null,
     sources: [{ url: 'u', label: 'l', tier: 'primary', role: 'obligation', quote: 'q' }], ...over } as Commitment);

describe('computeStatus — trigger rows', () => {
  it('an unfired trigger is pending', () => {
    expect(computeStatus(trig({}), now)).toBe('pending');
  });
  it('a fired-but-unruled trigger is overdue', () => {
    expect(computeStatus(trig({ triggerFired: true }), now)).toBe('overdue');
  });
  it('a resolved trigger keeps its resolution (resolution wins over triggerFired)', () => {
    expect(computeStatus(trig({ triggerFired: true, resolution: 'met' }), now)).toBe('met');
  });
});
