import type { Commitment, Source } from './types';
import { archiveFor } from './verification';
import { primarySource } from './sources';

const BASE = ['id','lab','track','title','description','category','committedOn','deadlineType','deadline','triggerText','resolution','resolvedOn','contested','reviewedOn','notes'] as const;
const SOURCE_SLOTS = 3;
const SOURCE_COLS = Array.from({ length: SOURCE_SLOTS }, (_, i) =>
  [`source_${i + 1}_url`, `source_${i + 1}_label`, `source_${i + 1}_role`]).flat();
const HEADER = [...BASE, ...SOURCE_COLS, 'archive_url'];

function esc(v: unknown): string { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export function toCsv(rows: Commitment[]): string {
  const lines = [HEADER.join(',')];
  for (const c of rows) {
    const base = BASE.map((k) => esc((c as unknown as Record<string, unknown>)[k]));
    const src: string[] = [];
    for (let i = 0; i < SOURCE_SLOTS; i++) {
      const s: Source | undefined = c.sources[i];
      src.push(esc(s?.url), esc(s?.label), esc(s?.role));
    }
    const archiveUrl = archiveFor(c.id, primarySource(c).url) ?? '';
    lines.push([...base, ...src, esc(archiveUrl)].join(','));   // archive_url from verification.json (empty when unverified)
  }
  return lines.join('\r\n') + '\r\n';
}
