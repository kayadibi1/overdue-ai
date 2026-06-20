import { describe, it, expect } from 'vitest';
import { snapshotUrl, archive } from '../src/watcher/wayback';

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
