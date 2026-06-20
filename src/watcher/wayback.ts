/**
 * Internet Archive Save-Page-Now (SPN2) archival.
 * Two exports: a PURE snapshot-URL builder and an async, never-throwing archiver.
 */

/** Build the canonical snapshot URL from an SPN2 status response. Pure. */
export function snapshotUrl(timestamp: string, originalUrl: string): string {
  return `https://web.archive.org/web/${timestamp}/${originalUrl}`;
}

/** Fetch the latest Wayback snapshot's text for a URL. Returns null if no snapshot / fetch fails. Never throws. Injectable fetch. */
export async function fetchSnapshotText(
  url: string,
  deps: { fetch?: typeof globalThis.fetch } = {},
): Promise<string | null> {
  const f = deps.fetch ?? fetch;
  try {
    const res = await f(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = await res.json();
    const snap = data?.archived_snapshots?.closest?.url;
    if (!snap) return null;
    const page = await f(snap, { signal: AbortSignal.timeout(20000) });
    if (!page.ok) return null;
    return await page.text();
  } catch { return null; }
}

export interface ArchiveResult {
  url: string | null;
  note?: string;
}

/**
 * Save-Page-Now v2 async flow: POST /save (form body url=..., Accept: json) → job_id
 * → poll GET /save/status/<job_id> until status==='success' (cap ~60s) → snapshotUrl.
 * On any failure / timeout / 429 → fall back to the availability API for an existing
 * snapshot; if none, return {url:null, note}. NEVER throws.
 * `deps` lets tests inject fetch + sleep; defaults use global fetch + real sleep.
 */
export async function archive(
  url: string,
  deps: { fetch?: typeof globalThis.fetch; sleep?: (ms: number) => Promise<void>; maxWaitMs?: number; auth?: string } = {},
): Promise<ArchiveResult> {
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxWait = deps.maxWaitMs ?? 60_000;

  async function fallback(reason: string): Promise<ArchiveResult> {
    try {
      const res = await f(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
      const data = (await res.json()) as { archived_snapshots?: { closest?: { url?: string } } };
      const closest = data?.archived_snapshots?.closest?.url;
      if (closest) return { url: closest, note: 'existing snapshot (SPN failed)' };
      return { url: null, note: 'unarchived (SPN failed, no snapshot)' };
    } catch {
      return { url: null, note: `unarchived (SPN failed, no snapshot)` };
    }
  }

  try {
    const saveRes = await f('https://web.archive.org/save', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(deps.auth ? { Authorization: deps.auth } : {}),
      },
      body: `url=${encodeURIComponent(url)}`,
    });
    const saveData = (await saveRes.json()) as { job_id?: string };
    const jobId = saveData?.job_id;
    if (!jobId) return await fallback('no job_id');

    const deadline = Date.now() + maxWait;
    for (;;) {
      const statusRes = await f(`https://web.archive.org/save/status/${jobId}`, {
        headers: { Accept: 'application/json', ...(deps.auth ? { Authorization: deps.auth } : {}) },
      });
      const status = (await statusRes.json()) as {
        status?: string;
        timestamp?: string;
        original_url?: string;
      };
      if (status?.status === 'success' && status.timestamp) {
        return { url: snapshotUrl(status.timestamp, status.original_url ?? url) };
      }
      if (status?.status === 'error') return await fallback('spn error');
      if (Date.now() + 3000 >= deadline) return await fallback('timeout');
      await sleep(3000);
    }
  } catch (e) {
    return { url: null, note: `archive error: ${e instanceof Error ? e.message : String(e)}` };
  }
}
