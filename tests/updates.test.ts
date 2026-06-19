import { describe, it, expect } from 'vitest';
import { joinUrl } from '../src/lib/urls';
import { UPDATES } from '../src/data/updates';
import { sortUpdates } from '../src/lib/updates';
import { COMMITMENTS } from '../src/data/commitments';
import { escapeXml, renderFeed } from '../src/lib/feed';

describe('joinUrl', () => {
  it('joins site + base + path with single slashes', () => {
    expect(joinUrl('https://x.org', '/overdue-ai', '/updates')).toBe('https://x.org/overdue-ai/updates');
  });
  it('tolerates missing/extra slashes and empty base', () => {
    expect(joinUrl('https://x.org/', 'overdue-ai/', 'updates')).toBe('https://x.org/overdue-ai/updates');
    expect(joinUrl('https://x.org', '/', '/feed.xml')).toBe('https://x.org/feed.xml');
    expect(joinUrl('https://x.org', '', 'feed.xml')).toBe('https://x.org/feed.xml');
  });
});

describe('sortUpdates', () => {
  it('orders newest date first, deterministic tie-break by id desc', () => {
    const a = { id: 'a', date: '2026-01-01', title: 't', body: 'b' };
    const b = { id: 'b', date: '2026-02-01', title: 't', body: 'b' };
    const c = { id: 'c', date: '2026-02-01', title: 't', body: 'b' };
    expect(sortUpdates([a, b, c]).map((u) => u.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('UPDATES integrity', () => {
  it('has unique ids', () => {
    const ids = UPDATES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('has real UTC calendar dates (not just the format)', () => {
    const isRealUtcDate = (s: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const [y, m, d] = s.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    };
    for (const u of UPDATES) expect(isRealUtcDate(u.date), u.id).toBe(true); // rejects 2026-02-31
  });
  it('references only existing commitments', () => {
    const known = new Set(COMMITMENTS.map((c) => c.id));
    for (const u of UPDATES) for (const id of u.commitmentIds ?? []) expect(known.has(id)).toBe(true);
  });
  it('pairs sourceUrl with sourceLabel', () => {
    for (const u of UPDATES) expect(Boolean(u.sourceUrl)).toBe(Boolean(u.sourceLabel));
  });
  it('is non-empty (seeded with the launch entry)', () => {
    expect(UPDATES.length).toBeGreaterThanOrEqual(1);
  });
});

describe('escapeXml', () => {
  it('escapes the five XML entities and leaves safe text alone', () => {
    expect(escapeXml('Anthropic & Co. <test> "x" \'y\'')).toBe(
      'Anthropic &amp; Co. &lt;test&gt; &quot;x&quot; &apos;y&apos;',
    );
    expect(escapeXml('plain text 123')).toBe('plain text 123');
  });
});

describe('renderFeed', () => {
  const opts = {
    siteUrl: 'https://x.org/overdue-ai',
    feedUrl: 'https://x.org/overdue-ai/feed.xml',
    title: 'Overdue — AI Safety Commitment Tracker',
    description: 'desc',
  };
  it('produces well-formed RSS with one item per update, newest first, escaped', () => {
    const xml = renderFeed(
      [
        { id: 'old', date: '2026-01-01', title: 'A & B', body: 'first' },
        { id: 'new', date: '2026-02-01', title: 'Second', body: 'second' },
      ],
      opts,
    );
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<title>Overdue — AI Safety Commitment Tracker</title>');
    expect(xml.indexOf('Second')).toBeLessThan(xml.indexOf('A &amp; B')); // newest first + escaped
    expect(xml).toContain('<guid isPermaLink="false">new</guid>');
    expect(xml).toContain('https://x.org/overdue-ai/updates#new');
    expect((xml.match(/<item>/g) || []).length).toBe(2);
    expect(xml).toContain('<lastBuildDate>Sun, 01 Feb 2026 00:00:00 GMT</lastBuildDate>'); // = newest update's date
  });
});
