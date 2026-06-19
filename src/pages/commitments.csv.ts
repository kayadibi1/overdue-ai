import type { APIRoute } from 'astro';
import { COMMITMENTS } from '../data/commitments';
import { toCsv } from '../lib/csv';

export const prerender = true;

export const GET: APIRoute = () => new Response(toCsv(COMMITMENTS), {
  headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="overdue-commitments.csv"' },
});
