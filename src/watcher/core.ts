import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { Commitment } from '../lib/types';
import { parseUTC, DAY_MS, computeStatus } from '../lib/status';

/** Visible text only: drop script/style/head/noscript (+ per-source selectors), collapse whitespace. */
export function extractText(html: string, stripSelectors: string[] = []): string {
  const $ = cheerio.load(html);
  $('script, style, head, noscript').remove();
  for (const sel of stripSelectors) $(sel).remove();
  const body = $('body');
  const text = (body.length ? body.text() : $.root().text()) || '';
  return text.replace(/\s+/g, ' ').trim();
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export interface DiffResult { changedLines: number; snippet: string; }

/** Sentence-level "what's new": chunks present in `next` but not in `prev`. */
export function diffSummary(prev: string, next: string, maxLines = 20): DiffResult {
  const split = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const prevSet = new Set(split(prev));
  const added = split(next).filter((s) => !prevSet.has(s));
  return { changedLines: added.length, snippet: added.slice(0, maxLines).join('\n') };
}

export function isMeaningfulChange(diff: DiffResult, threshold = 3): boolean {
  return diff.changedLines >= threshold;
}

export type DueKind = 'overdue' | 'upcoming';
export interface DueItem { c: Commitment; kind: DueKind; days: number; }

export function dueDeadlines(commitments: Commitment[], now: number, withinDays = 30, graceDays = 14): DueItem[] {
  const out: DueItem[] = [];
  for (const c of commitments) {
    if (c.track !== 'lab' || c.resolution !== null || c.deadlineType !== 'calendar' || !c.deadline) continue;
    const rawDays = (parseUTC(c.deadline) - now) / DAY_MS;
    const status = computeStatus(c, now); // 'upcoming' | 'overdue' — the SAME rule the board uses, so kind never disagrees
    if (status === 'upcoming') {
      const days = Math.ceil(rawDays);
      if (days <= withinDays) out.push({ c, kind: 'upcoming', days });
    } else if (status === 'overdue') {
      const days = Math.floor(-rawDays);
      if (days <= graceDays) out.push({ c, kind: 'overdue', days });
    }
  }
  return out;
}

export function issueMarker(kind: 'src' | 'deadline', id: string): string {
  return `<!-- watcher:${kind}:${id} -->`;
}
