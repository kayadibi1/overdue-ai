import { fetchWithStatus } from './core';
import { fetchSnapshotText } from './wayback';
import { extractPdfText, isPdfUrl } from './pdf';

export interface VerifyFetch { text: string | null; via: 'live' | 'archive' | 'none' | 'pdf'; dead: boolean; }

/** Default byte-fetch + extract for PDF sources. Own arrayBuffer fetch (fetchWithStatus returns text, not bytes). Never throws → null on any failure. */
async function fetchPdfText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; OverdueBot/1.0; +https://overduetracker.org)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const text = await extractPdfText(new Uint8Array(await res.arrayBuffer()));
    return text || null;        // '' (extract failure) → null → inconclusive, never a crash
  } catch {
    return null;
  }
}

/** Live first; a real 404/410 is `dead`; a block/timeout/5xx falls back to the Wayback snapshot. PDFs are read directly. Never throws. Injectable. */
export async function fetchVerifiable(
  url: string,
  deps: {
    live?: typeof fetchWithStatus;
    archive?: typeof fetchSnapshotText;
    pdf?: (url: string) => Promise<string | null>;
  } = {},
): Promise<VerifyFetch> {
  if (isPdfUrl(url)) {
    const text = await (deps.pdf ?? fetchPdfText)(url);
    return text ? { text, via: 'pdf', dead: false } : { text: null, via: 'none', dead: false };
  }
  const live = deps.live ?? fetchWithStatus;
  const archive = deps.archive ?? fetchSnapshotText;
  const r = await live(url);
  if (r.text != null) return { text: r.text, via: 'live', dead: false };
  if (r.status === 404 || r.status === 410) return { text: null, via: 'none', dead: true };
  const snap = await archive(url);                       // blocked / 5xx / network → try the archive
  if (snap != null) return { text: snap, via: 'archive', dead: false };
  return { text: null, via: 'none', dead: false };        // couldn't verify — NOT dead
}
