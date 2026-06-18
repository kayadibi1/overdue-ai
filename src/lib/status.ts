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

export interface RelTime { label: string; kind: 'overdue' | 'upcoming' | 'resolved'; days: number; }

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/**
 * Live label for a dated, unresolved commitment, computed purely from its
 * deadline. SHARED by relativeTime (build-time) and the client island (runtime)
 * so server HTML and live ticks can never diverge.
 */
export function liveLabel(deadline: string, now: number): { label: string; kind: 'overdue' | 'upcoming'; days: number } {
  const ms = parseUTC(deadline);
  if (ms > now) {
    const days = Math.ceil((ms - now) / DAY_MS);
    return { label: `in ${plural(days, 'day')}`, kind: 'upcoming', days };
  }
  const days = Math.floor((now - ms) / DAY_MS);
  return { label: days === 0 ? 'due today' : `${plural(days, 'day')} overdue`, kind: 'overdue', days };
}

export function relativeTime(c: Commitment, now: number): RelTime | null {
  const status = computeStatus(c, now);
  if ((status === 'overdue' || status === 'upcoming') && c.deadline) {
    return liveLabel(c.deadline, now);
  }
  if ((status === 'met' || status === 'missed' || status === 'partial') && c.deadline && c.resolvedOn) {
    const days = Math.round((parseUTC(c.resolvedOn) - parseUTC(c.deadline)) / DAY_MS);
    if (days > 0) return { label: `resolved ${plural(days, 'day')} late`, kind: 'resolved', days };
    if (days < 0) return { label: `resolved ${plural(-days, 'day')} early`, kind: 'resolved', days };
    return { label: 'resolved on time', kind: 'resolved', days: 0 };
  }
  return null;
}

export function summarize(list: Commitment[], now: number): Record<Status, number> {
  const counts: Record<Status, number> = { met: 0, missed: 0, partial: 0, overdue: 0, upcoming: 0, pending: 0 };
  for (const c of list) counts[computeStatus(c, now)]++;
  return counts;
}

const URGENCY: Record<Status, number> = { overdue: 0, upcoming: 1, pending: 2, missed: 3, partial: 4, met: 5 };

export function sortByUrgency(list: Commitment[], now: number): Commitment[] {
  return [...list].sort((a, b) => {
    const sa = computeStatus(a, now), sb = computeStatus(b, now);
    if (URGENCY[sa] !== URGENCY[sb]) return URGENCY[sa] - URGENCY[sb];
    const ra = relativeTime(a, now), rb = relativeTime(b, now);
    if (sa === 'overdue') return (rb?.days ?? 0) - (ra?.days ?? 0);   // most overdue first
    if (sa === 'upcoming') return (ra?.days ?? 0) - (rb?.days ?? 0);  // soonest first
    const da = a.deadline ? parseUTC(a.deadline) : -Infinity;
    const db = b.deadline ? parseUTC(b.deadline) : -Infinity;
    return db - da;                                                   // most recent first
  });
}
