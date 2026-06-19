import type { Commitment } from './types';
const COLS = ['id','lab','track','title','description','category','committedOn','deadlineType','deadline','triggerText','resolution','resolvedOn','evidenceUrl','sourceLabel','contested','lastChecked','notes'] as const;
function esc(v: unknown): string { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
export function toCsv(rows: Commitment[]): string {
  const lines = [COLS.join(','), ...rows.map((c) => COLS.map((k) => esc((c as Record<string, unknown>)[k])).join(','))];
  return lines.join('\r\n') + '\r\n';
}
