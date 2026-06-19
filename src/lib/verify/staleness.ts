import type { Commitment } from '../types';
export const STALE_DAYS = { volatile: 30, settled: 180 };
const DAY = 86_400_000;
export function isStale(c: Commitment, now: number): boolean {
  if (!c.reviewedOn) return true;
  const age = (now - Date.parse(c.reviewedOn)) / DAY;
  const volatile = c.contested || !c.resolution;
  return age > (volatile ? STALE_DAYS.volatile : STALE_DAYS.settled);
}
