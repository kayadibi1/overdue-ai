import { describe, it, expect } from 'vitest';
import { snapshotUrl, archive, fetchSnapshotText } from '../src/watcher/wayback';

const noopSleep = async () => {};

describe('snapshotUrl (pure)', () => {
  it('builds the canonical snapshot URL', () => {
    expect(snapshotUrl('20260619', 'https://x')).toBe('https://web.archive.org/web/20260619/https://x');
  });
});

describe('archive (SPN2 async flow)', () => {
  it('returns the snapshot URL when the save job succeeds', async () => {
    const calls: string[] = [];
    const fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/save')) {
        return new Response(JSON.stringify({ job_id: 'job-1' }), { status: 200 });
      }
      // status poll
      return new Response(
        JSON.stringify({ status: 'success', timestamp: '20260619000000', original_url: 'https://x' }),
        { status: 200 },
      );
    }) as unknown as typeof globalThis.fetch;

    const res = await archive('https://x', { fetch, sleep: noopSleep, maxWaitMs: 10 });
    expect(res.url).toBe('https://web.archive.org/web/20260619000000/https://x');
    expect(calls[0]).toBe('https://web.archive.org/save');
  });

  it('falls back to the availability API when SPN errors', async () => {
    const fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/save')) {
        return new Response(JSON.stringify({ job_id: 'job-2' }), { status: 200 });
      }
      if (url.includes('/save/status/')) {
        return new Response(JSON.stringify({ status: 'error', message: 'boom' }), { status: 200 });
      }
      // availability API
      return new Response(
        JSON.stringify({
          archived_snapshots: { closest: { url: 'https://web.archive.org/web/20200101/https://x', available: true } },
        }),
        { status: 200 },
      );
    }) as unknown as typeof globalThis.fetch;

    const res = await archive('https://x', { fetch, sleep: noopSleep, maxWaitMs: 10 });
    expect(res.url).toBe('https://web.archive.org/web/20200101/https://x');
    expect(res.note).toBe('existing snapshot (SPN failed)');
  });

  it('never throws — returns {url:null} when everything fails', async () => {
    const fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof globalThis.fetch;

    const res = await archive('https://x', { fetch, sleep: noopSleep, maxWaitMs: 10 });
    expect(res.url).toBeNull();
    expect(res.note).toContain('archive error');
  });

  it('returns {url:null} with a note when SPN fails and no snapshot exists', async () => {
    const fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/save')) {
        return new Response(JSON.stringify({}), { status: 200 }); // no job_id → fallback
      }
      return new Response(JSON.stringify({ archived_snapshots: {} }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const res = await archive('https://x', { fetch, sleep: noopSleep, maxWaitMs: 10 });
    expect(res.url).toBeNull();
    expect(res.note).toBe('unarchived (SPN failed, no snapshot)');
  });
});

describe('fetchSnapshotText', () => {
  it('returns the snapshot HTML when availability has a closest.url', async () => {
    const SNAP = 'https://web.archive.org/web/20200101/https://x';
    const fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wayback/available')) {
        return new Response(
          JSON.stringify({ archived_snapshots: { closest: { url: SNAP, available: true } } }),
          { status: 200 },
        );
      }
      // the snapshot page itself
      return new Response('<html><body>archived obligation text</body></html>', { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const text = await fetchSnapshotText('https://x', { fetch });
    expect(text).toBe('<html><body>archived obligation text</body></html>');
  });

  it('returns null when availability has no snapshot', async () => {
    const fetch = (async () =>
      new Response(JSON.stringify({ archived_snapshots: {} }), { status: 200 })) as unknown as typeof globalThis.fetch;
    expect(await fetchSnapshotText('https://x', { fetch })).toBeNull();
  });

  it('returns null (never throws) when fetch throws', async () => {
    const fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof globalThis.fetch;
    await expect(fetchSnapshotText('https://x', { fetch })).resolves.toBeNull();
  });
});
