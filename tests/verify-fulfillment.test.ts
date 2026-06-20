import { describe, it, expect } from 'vitest';
import { proposeFulfillment, type Proposal } from '../src/lib/verify/fulfillment';
import type { FulfillmentCheck } from '../src/lib/types';

const NOW = Date.UTC(2026, 5, 19); // 2026-06-19

function check(over: Partial<FulfillmentCheck> = {}): FulfillmentCheck {
  return { type: 'url-exists', url: 'https://example.com/artifact', by: '2026-06-25', ...over };
}

describe('proposeFulfillment', () => {
  it('artifact present (no foundOn), now BEFORE deadline → met', () => {
    const p = proposeFulfillment(check(), { artifactFound: true }, NOW);
    expect(p).toEqual<Proposal>({ kind: 'class-A', status: 'met', evidence: 'artifact present at https://example.com/artifact' });
  });

  it('artifact present (no foundOn), now AFTER deadline → met (present is met regardless)', () => {
    const after = Date.UTC(2026, 6, 1); // 2026-07-01, past the 2026-06-25 deadline
    const p = proposeFulfillment(check(), { artifactFound: true }, after);
    expect(p?.status).toBe('met');
  });

  it('artifact present with foundOn ≤ by → met', () => {
    const p = proposeFulfillment(check(), { artifactFound: true, foundOn: '2026-06-20' }, NOW);
    expect(p?.status).toBe('met');
    expect(p?.kind).toBe('class-A');
  });

  it('artifact present with foundOn AFTER by → null (found-late, ambiguous)', () => {
    const p = proposeFulfillment(check(), { artifactFound: true, foundOn: '2026-06-26' }, NOW);
    expect(p).toBeNull();
  });

  it('artifact absent, deadline passed → missed', () => {
    const after = Date.UTC(2026, 6, 1); // past 2026-06-25
    const p = proposeFulfillment(check(), { artifactFound: false }, after);
    expect(p).toEqual<Proposal>({ kind: 'class-A', status: 'missed', evidence: 'no artifact at https://example.com/artifact by 2026-06-25' });
  });

  it('artifact absent, deadline NOT yet passed → null', () => {
    const p = proposeFulfillment(check(), { artifactFound: false }, NOW);
    expect(p).toBeNull();
  });
});
