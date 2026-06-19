import type { APIRoute } from 'astro';
import { UPDATES } from '../data/updates';
import { sortUpdates } from '../lib/updates';

export const prerender = true;

// Deployed to the box as /var/www/overdue/updates.json; send_update.py reads it to
// mail the newest (or a given) entry to confirmed subscribers. Mirrors
// commitments.json.ts (prerender; one source array, emitted sorted newest-first).
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ updates: sortUpdates(UPDATES) }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
