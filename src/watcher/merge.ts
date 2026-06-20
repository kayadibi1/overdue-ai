import type { RowState, VerificationState } from '../lib/verify/schema';

const substantive = (r: RowState): string =>
  JSON.stringify({ sources: r.sources, problems: r.problems, proposals: r.proposals ?? null });

/**
 * Merge fresh check rows over the prior state. A row's `lastChangedOn` advances
 * only when its substantive content (sources/problems/proposals) changed — so a
 * quiet run produces output identical to `prev` and `changed` is false (no commit
 * / no redeploy). Archive URLs etc. legitimately changing WILL flip `changed`.
 */
export function mergeVerification(
  prev: VerificationState,
  freshRows: Record<string, RowState>,
  today: string,
): { next: VerificationState; changed: boolean } {
  const rows: Record<string, RowState> = {};
  for (const [id, row] of Object.entries(freshRows)) {
    const p = prev.rows[id];
    const rowChanged = !p || substantive(p) !== substantive(row);
    rows[id] = { ...row, lastChangedOn: rowChanged ? today : (p?.lastChangedOn ?? today) };
  }
  const next: VerificationState = { rows };
  const changed = JSON.stringify(prev) !== JSON.stringify(next);
  return { next, changed };
}
