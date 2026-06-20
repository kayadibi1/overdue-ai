import { describe, it, expect } from 'vitest';
import { mergeVerification } from '../src/watcher/merge';
import { parseVerification } from '../src/lib/verify/schema';
import type { RowState, VerificationState } from '../src/lib/verify/schema';

const TODAY = '2026-06-19';

const row = (over: Partial<RowState> = {}): RowState => ({
  sources: [{ url: 'https://example.com/a', linkOk: true, quoteCheck: 'ok' }],
  problems: [],
  ...over,
});

describe('mergeVerification', () => {
  it('a brand-new row → lastChangedOn=today, changed=true', () => {
    const prev: VerificationState = { rows: {} };
    const { next, changed } = mergeVerification(prev, { x: row() }, TODAY);
    expect(next.rows.x.lastChangedOn).toBe(TODAY);
    expect(changed).toBe(true);
  });

  it('an unchanged row → lastChangedOn preserved, changed=false', () => {
    const prev: VerificationState = { rows: { x: row({ lastChangedOn: '2026-01-01' }) } };
    const { next, changed } = mergeVerification(prev, { x: row() }, TODAY);
    expect(next.rows.x.lastChangedOn).toBe('2026-01-01');
    expect(changed).toBe(false);
  });

  it('a row whose problems changed → lastChangedOn=today, changed=true', () => {
    const prev: VerificationState = { rows: { x: row({ lastChangedOn: '2026-01-01' }) } };
    const fresh = { x: row({ problems: ['dead link: https://example.com/a'] }) };
    const { next, changed } = mergeVerification(prev, fresh, TODAY);
    expect(next.rows.x.lastChangedOn).toBe(TODAY);
    expect(changed).toBe(true);
  });

  it('archiveUrl changing (substantive: a source field) flips changed=true', () => {
    const prev: VerificationState = { rows: { x: row({ lastChangedOn: '2026-01-01' }) } };
    const fresh = {
      x: row({
        sources: [{ url: 'https://example.com/a', linkOk: true, quoteCheck: 'ok' as const, archiveUrl: 'https://web.archive.org/x' }],
      }),
    };
    const { next, changed } = mergeVerification(prev, fresh, TODAY);
    expect(next.rows.x.lastChangedOn).toBe(TODAY);
    expect(changed).toBe(true);
  });
});

describe('round-trip validation predicate', () => {
  // The watcher refuses to write `next` unless it round-trips through parseVerification
  // with the SAME set of row keys. This guards against ever persisting a corrupt file.
  it('a next built from valid RowStates keeps the same row keys', () => {
    const prev: VerificationState = { rows: {} };
    const { next } = mergeVerification(prev, { a: row(), b: row() }, TODAY);
    const valid = parseVerification(next);
    expect(Object.keys(valid.rows).length).toBe(Object.keys(next.rows).length);
    expect(Object.keys(valid.rows).sort()).toEqual(['a', 'b']);
  });

  it('a corrupted state (sources not an array) drops to {rows:{}} → fewer keys → refused', () => {
    // Simulate a corrupt `next` that should never be written.
    const corrupt = { rows: { x: { sources: 'not-an-array', problems: [] } } } as unknown as VerificationState;
    const valid = parseVerification(corrupt);
    expect(Object.keys(valid.rows).length).toBe(0);
    expect(Object.keys(valid.rows).length).not.toBe(Object.keys(corrupt.rows).length);
  });
});
