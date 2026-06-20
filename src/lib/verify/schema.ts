export interface SourceState {
  url: string;
  linkOk: boolean;
  quoteCheck: 'ok' | 'inconclusive' | 'drifted' | 'n/a';
  archiveUrl?: string;
}
export interface RowState {
  sources: SourceState[];
  problems: string[];
  proposals?: unknown[];
  lastChangedOn?: string;
}
export interface VerificationState { rows: Record<string, RowState>; }

/** Returns a valid VerificationState, or {rows:{}} on ANY shape violation. Never throws. */
export function parseVerification(raw: unknown): VerificationState {
  try {
    if (!raw || typeof raw !== 'object') return { rows: {} };
    const rowsIn = (raw as { rows?: unknown }).rows;
    if (!rowsIn || typeof rowsIn !== 'object') return { rows: {} };
    const rows: Record<string, RowState> = {};
    for (const [id, v] of Object.entries(rowsIn as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') return { rows: {} };
      const row = v as Record<string, unknown>;
      if (!Array.isArray(row.sources) || !Array.isArray(row.problems)) return { rows: {} };
      const sources: SourceState[] = [];
      for (const s of row.sources) {
        if (!s || typeof s !== 'object') return { rows: {} };
        const so = s as Record<string, unknown>;
        if (typeof so.url !== 'string' || typeof so.linkOk !== 'boolean') return { rows: {} };
        if (so.quoteCheck !== 'ok' && so.quoteCheck !== 'inconclusive' && so.quoteCheck !== 'drifted' && so.quoteCheck !== 'n/a') return { rows: {} };
        sources.push({ url: so.url, linkOk: so.linkOk, quoteCheck: so.quoteCheck,
          archiveUrl: typeof so.archiveUrl === 'string' ? so.archiveUrl : undefined });
      }
      if (!row.problems.every((p) => typeof p === 'string')) return { rows: {} };
      rows[id] = { sources, problems: row.problems as string[],
        proposals: Array.isArray(row.proposals) ? row.proposals : undefined,
        lastChangedOn: typeof row.lastChangedOn === 'string' ? row.lastChangedOn : undefined };
    }
    return { rows };
  } catch { return { rows: {} }; }
}
