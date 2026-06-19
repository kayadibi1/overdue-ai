import type { APIRoute } from 'astro';
import { UPDATES } from '../data/updates';
import { renderFeed } from '../lib/feed';
import { absUrl } from '../lib/urls';
import { FEED_TITLE, FEED_DESCRIPTION } from '../lib/site';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    renderFeed(UPDATES, {
      siteUrl: absUrl('/'),
      feedUrl: absUrl('/feed.xml'),
      title: FEED_TITLE,
      description: FEED_DESCRIPTION,
    }),
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
