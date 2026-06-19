import { describe, it, expect } from 'vitest';
import { parseVerification } from '../src/lib/verify/schema';

describe('parseVerification (defensive core)', () => {
  it('returns {rows:{}} for non-object / malformed inputs', () => {
    expect(parseVerification(null)).toEqual({ rows: {} });
    expect(parseVerification(undefined)).toEqual({ rows: {} });
    expect(parseVerification(42)).toEqual({ rows: {} });
    expect(parseVerification({})).toEqual({ rows: {} });
    expect(parseVerification({ rows: 'x' })).toEqual({ rows: {} });
    expect(parseVerification({ rows: { a: {} } })).toEqual({ rows: {} });
    expect(parseVerification({ rows: { a: { sources: [{ url: 1 }], problems: [] } } })).toEqual({ rows: {} });
  });

  it('preserves a valid object round-trip', () => {
    const valid = {
      rows: {
        x: {
          sources: [{ url: 'u', linkOk: true, quoteCheck: 'ok' }],
          problems: ['p'],
          lastChangedOn: '2026-06-19',
        },
      },
    };
    const out = parseVerification(valid);
    expect(out.rows.x).toBeDefined();
    expect(out.rows.x.sources).toEqual([{ url: 'u', linkOk: true, quoteCheck: 'ok', archiveUrl: undefined }]);
    expect(out.rows.x.problems).toEqual(['p']);
    expect(out.rows.x.lastChangedOn).toBe('2026-06-19');
  });
});
