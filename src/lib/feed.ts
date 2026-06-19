import type { Update } from '../data/updates';
import { sortUpdates } from './updates';

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface FeedOpts {
  siteUrl: string;
  feedUrl: string;
  title: string;
  description: string;
}

/** Pure RSS 2.0 renderer (no Astro env), so the feed is fully unit-testable. */
export function renderFeed(updates: Update[], o: FeedOpts): string {
  const sorted = sortUpdates(updates);
  const lastBuildDate = (sorted[0] ? new Date(`${sorted[0].date}T00:00:00Z`) : new Date(0)).toUTCString();
  const items = sorted
    .map((u) => {
      const link = `${o.siteUrl.replace(/\/+$/, '')}/updates#${u.id}`;
      const pub = new Date(`${u.date}T00:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(u.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(u.id)}</guid>
      <pubDate>${pub}</pubDate>
      <description>${escapeXml(u.body)}</description>
    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(o.title)}</title>
    <link>${escapeXml(o.siteUrl)}</link>
    <description>${escapeXml(o.description)}</description>
    <atom:link href="${escapeXml(o.feedUrl)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
