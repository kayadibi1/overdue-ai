import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/lib/csv';
import { COMMITMENTS } from '../src/data/commitments';

describe('CSV export — clean break to sources[]', () => {
  const header = toCsv(COMMITMENTS).split('\r\n')[0];

  it('has flattened source columns + archive_url + reviewedOn', () => {
    expect(header).toContain('source_1_url');
    expect(header).toContain('source_1_label');
    expect(header).toContain('source_1_role');
    expect(header).toContain('source_3_role');
    expect(header).toContain('archive_url');
    expect(header).toContain('reviewedOn');
  });

  it('drops the removed evidenceUrl/sourceLabel/lastChecked columns', () => {
    expect(header).not.toContain('evidenceUrl');
    expect(header).not.toContain('sourceLabel');
    expect(header).not.toContain('lastChecked');
  });

  it('emits one row per commitment plus a header', () => {
    const lines = toCsv(COMMITMENTS).trimEnd().split('\r\n');
    expect(lines.length).toBe(COMMITMENTS.length + 1);
  });
});
