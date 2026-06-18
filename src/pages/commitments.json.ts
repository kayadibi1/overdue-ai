import type { APIRoute } from 'astro';
import { COMMITMENTS } from '../data/commitments';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ updated: new Date().toISOString().slice(0, 10), commitments: COMMITMENTS }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
