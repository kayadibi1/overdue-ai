import type { FulfillmentCheck } from '../types';

export interface Proposal { kind: 'class-A'; status: 'met' | 'missed'; evidence: string; }

/** Pure. Given the check and an observation, propose a verdict or null (no proposal). */
export function proposeFulfillment(
  check: FulfillmentCheck,
  obs: { artifactFound: boolean; foundOn?: string | null },
  now: number,
): Proposal | null {
  const by = Date.parse(`${check.by}T00:00:00Z`);
  if (obs.artifactFound) {
    if (!obs.foundOn || Date.parse(`${obs.foundOn}T00:00:00Z`) <= by)
      return { kind: 'class-A', status: 'met', evidence: `artifact present at ${check.url}` };
    return null; // found but after the deadline — ambiguous, leave to a human
  }
  if (now > by) return { kind: 'class-A', status: 'missed', evidence: `no artifact at ${check.url} by ${check.by}` };
  return null; // deadline not yet passed
}
