import { fetchWithStatus } from './core';
import { fetchSnapshotText } from './wayback';

export interface VerifyFetch { text: string | null; via: 'live' | 'archive' | 'none'; dead: boolean; }

/** Live first; a real 404/410 is `dead`; a block/timeout/5xx falls back to the Wayback snapshot. Never throws. Injectable. */
export async function fetchVerifiable(
  url: string,
  deps: { live?: typeof fetchWithStatus; archive?: typeof fetchSnapshotText } = {},
): Promise<VerifyFetch> {
  const live = deps.live ?? fetchWithStatus;
  const archive = deps.archive ?? fetchSnapshotText;
  const r = await live(url);
  if (r.text != null) return { text: r.text, via: 'live', dead: false };
  if (r.status === 404 || r.status === 410) return { text: null, via: 'none', dead: true };
  const snap = await archive(url);                       // blocked / 5xx / network → try the archive
  if (snap != null) return { text: snap, via: 'archive', dead: false };
  return { text: null, via: 'none', dead: false };        // couldn't verify — NOT dead
}
