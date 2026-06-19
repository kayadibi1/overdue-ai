import type { Commitment } from '../types';

export interface Problem { id: string; rule: string; detail: string; }

export function checkInvariants(c: Commitment): Problem[] {
  const out: Problem[] = [];
  const P = (rule: string, detail: string) => out.push({ id: c.id, rule, detail });
  for (const s of c.sources) {
    if (s.role === 'obligation' && !s.quote?.trim())
      P('obligation-quote', `obligation source ${s.url} has no quote`);
  }
  if (c.deadlineBasis === 'derived' && !c.derivationNote?.trim())
    P('derived-note', 'derived deadline lacks derivationNote');
  if (c.resolution === 'missed') {
    if (!c.reviewedBy?.trim()) P('missed-signoff', 'missed ruling needs reviewedBy');
    const hasPrimaryFulfil = c.sources.some(s => s.role === 'fulfillment' && s.tier === 'primary');
    if (c.sources.length < 2 && !hasPrimaryFulfil)
      P('missed-sourcing', 'missed needs >=2 sources or a primary fulfillment source');
  }
  return out;
}
