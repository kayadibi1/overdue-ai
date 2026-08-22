import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/lib/csv';
import { COMMITMENTS } from '../src/data/commitments';
import type { Commitment } from '../src/lib/types';

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

describe('CSV export — source slots widen instead of truncating', () => {
  const row = (id: string, n: number): Commitment => ({
    id, lab: 'Anthropic', track: 'lab', title: id, description: '', category: 'safety-framework',
    committedOn: '2024-01-01', deadlineType: 'calendar', deadline: '2025-01-01',
    sources: Array.from({ length: n }, (_, i) => ({
      url: `https://example.com/${id}/${i + 1}`, label: `L${i + 1}`, tier: 'primary',
      role: i === 0 ? 'obligation' : 'context', ...(i === 0 ? { quote: 'q' } : {}),
    })),
  } as Commitment);

  it('keeps the 3-slot floor for rows citing fewer sources', () => {
    const header = toCsv([row('one', 1)]).split('\r\n')[0];
    expect(header).toContain('source_3_role');
    expect(header).not.toContain('source_4_url');
  });

  it('emits a slot for every source when a row cites more than three', () => {
    const csv = toCsv([row('many', 5)]);
    const [header, data] = csv.split('\r\n');
    expect(header).toContain('source_5_role');
    expect(header).not.toContain('source_6_url');
    expect(data).toContain('https://example.com/many/5');   // was silently dropped before
  });

  it('widens every row to the widest row, keeping the grid rectangular', () => {
    const lines = toCsv([row('a', 1), row('b', 4)]).trimEnd().split('\r\n');
    const widths = lines.map((l) => l.split(',').length);
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe(15 + 4 * 3 + 1);   // BASE + 4 source slots + archive_url
  });
});
