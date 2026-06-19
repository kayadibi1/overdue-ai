import type { APIRoute } from 'astro';
import { UPDATES } from '../data/updates';
import { renderFeed } from '../lib/feed';
import { CANONICAL_ORIGIN, FEED_TITLE, FEED_DESCRIPTION } from '../lib/site';

export const prerender = true;

// Feed links always use the canonical apex (even in the PAGES=1 backup build), so a reader
// who subscribes from the github.io backup still gets overduetracker.org item links.
export const GET: APIRoute = () =>
  new Response(
    renderFeed(UPDATES, {
      siteUrl: CANONICAL_ORIGIN,
      feedUrl: `${CANONICAL_ORIGIN}/feed.xml`,
      title: FEED_TITLE,
      description: FEED_DESCRIPTION,
    }),
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
