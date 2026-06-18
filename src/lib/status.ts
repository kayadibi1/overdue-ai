import type { Commitment, Status } from './types';

export const DAY_MS = 86_400_000;

/** Parse 'YYYY-MM-DD' as UTC midnight (avoids timezone off-by-one). */
export function parseUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function computeStatus(c: Commitment, now: number): Status {
  if (c.resolution) return c.resolution;
  if (c.deadlineType === 'calendar' && c.deadline) {
    return parseUTC(c.deadline) > now ? 'upcoming' : 'overdue';
  }
  return 'pending';
}
