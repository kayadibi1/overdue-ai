import type { Commitment, Source } from './types';
import { archiveFor } from './verification';
import { primarySource } from './sources';

const BASE = ['id','lab','track','title','description','category','committedOn','deadlineType','deadline','triggerText','resolution','resolvedOn','contested','reviewedOn','notes'] as const;
// Sources are flattened into numbered slots. Three slots is the published floor
// (so the schema stays stable for reusers even as rows gain/lose sources); the
// export widens past it rather than truncating a row that cites more.
const MIN_SOURCE_SLOTS = 3;
const sourceCols = (slots: number) => Array.from({ length: slots }, (_, i) =>
  [`source_${i + 1}_url`, `source_${i + 1}_label`, `source_${i + 1}_role`]).flat();

function esc(v: unknown): string { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export function toCsv(rows: Commitment[]): string {
  const slots = Math.max(MIN_SOURCE_SLOTS, ...rows.map((c) => c.sources.length));
  const lines = [[...BASE, ...sourceCols(slots), 'archive_url'].join(',')];
  for (const c of rows) {
    const base = BASE.map((k) => esc((c as unknown as Record<string, unknown>)[k]));
    const src: string[] = [];
    for (let i = 0; i < slots; i++) {
      const s: Source | undefined = c.sources[i];
      src.push(esc(s?.url), esc(s?.label), esc(s?.role));
    }
    const archiveUrl = archiveFor(c.id, primarySource(c).url) ?? '';
    lines.push([...base, ...src, esc(archiveUrl)].join(','));   // archive_url from verification.json (empty when unverified)
  }
  return lines.join('\r\n') + '\r\n';
}
