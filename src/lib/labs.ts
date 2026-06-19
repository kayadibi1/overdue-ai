import type { Commitment, Lab } from './types';
import { LABS } from './types';

export function labSlug(lab: string): string { return lab.toLowerCase().replace(/\s+/g, '-'); }
export function labFromSlug(slug: string): Lab | null { return LABS.find((l) => labSlug(l) === slug) ?? null; }

/** Lab-track commitments grouped by lab, only labs that have any. */
export function commitmentsByLab(commitments: Commitment[]): Map<Lab, Commitment[]> {
  const m = new Map<Lab, Commitment[]>();
  for (const c of commitments) {
    if (c.track !== 'lab') continue;
    if (!m.has(c.lab)) m.set(c.lab, []);
    m.get(c.lab)!.push(c);
  }
  return m;
}

/** Kept-rate among RESOLVED commitments: met / (met+missed+partial). null if none resolved. */
export function keptRate(list: Commitment[]): { met: number; resolved: number; rate: number | null } {
  const resolved = list.filter((c) => c.resolution !== null);
  const met = resolved.filter((c) => c.resolution === 'met').length;
  return { met, resolved: resolved.length, rate: resolved.length ? met / resolved.length : null };
}
