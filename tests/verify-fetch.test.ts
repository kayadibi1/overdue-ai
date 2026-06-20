import { describe, it, expect } from 'vitest';
import { fetchVerifiable } from '../src/watcher/verify-fetch';

describe('fetchVerifiable', () => {
  it('live returns text → {via:"live", dead:false}', async () => {
    const live = async () => ({ text: '<body>live</body>', status: 200 });
    const archive = async () => 'should-not-be-used';
    const r = await fetchVerifiable('https://x', { live, archive });
    expect(r).toEqual({ text: '<body>live</body>', via: 'live', dead: false });
  });

  it('live 404 → {dead:true, text:null} and does NOT consult the archive', async () => {
    let archiveCalled = false;
    const live = async () => ({ text: null, status: 404 });
    const archive = async () => { archiveCalled = true; return 'snap'; };
    const r = await fetchVerifiable('https://x', { live, archive });
    expect(r).toEqual({ text: null, via: 'none', dead: true });
    expect(archiveCalled).toBe(false);
  });

  it('live 410 → {dead:true, text:null}', async () => {
    const live = async () => ({ text: null, status: 410 });
    const archive = async () => 'snap';
    const r = await fetchVerifiable('https://x', { live, archive });
    expect(r).toEqual({ text: null, via: 'none', dead: true });
  });

  it('live 403 (blocked) + archive has text → {via:"archive", dead:false}', async () => {
    const live = async () => ({ text: null, status: 403 });
    const archive = async () => '<body>archived</body>';
    const r = await fetchVerifiable('https://x', { live, archive });
    expect(r).toEqual({ text: '<body>archived</body>', via: 'archive', dead: false });
  });

  it('live timeout (null status) + archive has text → {via:"archive"}', async () => {
    const live = async () => ({ text: null, status: null });
    const archive = async () => '<body>archived</body>';
    const r = await fetchVerifiable('https://x', { live, archive });
    expect(r.via).toBe('archive');
    expect(r.dead).toBe(false);
  });

  it('live 403 (blocked) + archive null → {via:"none", dead:false} (could not verify, NOT dead)', async () => {
    const live = async () => ({ text: null, status: 403 });
    const archive = async () => null;
    const r = await fetchVerifiable('https://x', { live, archive });
    expect(r).toEqual({ text: null, via: 'none', dead: false });
  });
});
