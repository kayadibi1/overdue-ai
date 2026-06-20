import type { Commitment } from '../lib/types';
import type { RowState, SourceState } from '../lib/verify/schema';
import { extractText, issueMarker } from './core';
import { classifyQuote } from '../lib/verify/classify';
import { isStale } from '../lib/verify/staleness';
import { checkInvariants } from '../lib/verify/invariants';
import { proposeFulfillment } from '../lib/verify/fulfillment';

export interface PlannedIssue { marker: string; title: string; body: string; }
export type FetchFn = (url: string) => Promise<string | null>;

export async function runChecks(
  commitments: Commitment[],
  prev: Record<string, RowState>,
  now: number,
  fetchFn: FetchFn,
): Promise<{ issues: PlannedIssue[]; rows: Record<string, RowState> }> {
  const issues: PlannedIssue[] = [];
  const rows: Record<string, RowState> = {};
  for (const c of commitments) {
    const problems: string[] = [];
    const sources: SourceState[] = [];
    for (const s of c.sources) {
      const prevSrc = prev[c.id]?.sources.find((p) => p.url === s.url);
      const html = await fetchFn(s.url);
      const linkOk = html != null;
      let quoteCheck: 'ok' | 'inconclusive' | 'drifted' = 'ok';
      if (!linkOk) {
        problems.push(`dead link: ${s.url}`);
        quoteCheck = 'inconclusive';
      } else if (s.role === 'obligation' && s.quote) {
        quoteCheck = classifyQuote(extractText(html), s.quote, prevSrc?.quoteCheck === 'ok');
        if (quoteCheck === 'drifted') problems.push(`quote drifted: ${s.url}`);
      }
      sources.push({ url: s.url, linkOk, quoteCheck, archiveUrl: prevSrc?.archiveUrl });
    }
    if (isStale(c, now)) problems.push(`ruling not reviewed since ${c.reviewedOn ?? 'never'} — re-review due`);
    for (const p of checkInvariants(c)) problems.push(`invariant ${p.rule}: ${p.detail}`);
    rows[c.id] = { sources, problems, lastChangedOn: prev[c.id]?.lastChangedOn };

    // Class-A deterministic fulfillment: only for UNRESOLVED rows with a machine-checkable check.
    // A human still rules — we only PROPOSE met/missed; resolution is never set here.
    if (c.resolution === null && c.fulfillmentCheck && c.fulfillmentCheck.type !== 'changed-since') {
      const fc = c.fulfillmentCheck;
      let artifactFound = false;
      const html = await fetchFn(fc.url);
      if (fc.type === 'url-exists') {
        artifactFound = html != null;
      } else if (fc.type === 'page-contains') {
        artifactFound = html != null && extractText(html).toLowerCase().includes((fc.pattern ?? '').toLowerCase());
      }
      const proposal = proposeFulfillment(fc, { artifactFound }, now); // foundOn unknown → undefined
      if (proposal) {
        rows[c.id].proposals = [proposal];
        const marker = issueMarker('fulfillment', c.id);
        issues.push({
          marker,
          title: `Fulfillment proposal: ${c.title}`,
          body: `${marker}\n\n**${c.lab} — ${c.title}**\n\nProposed status: **${proposal.status}**\nEvidence: ${proposal.evidence}\n\nConfirm and set \`resolution\` in \`src/data/commitments.ts\` — automation never rules.`,
        });
      }
    }

    if (problems.length) {
      issues.push({
        marker: issueMarker('source', c.id),
        title: `Verification: ${c.title}`,
        body: `${issueMarker('source', c.id)}\n\n**${c.lab} — ${c.title}**\n\n${problems.map((p) => `- ${p}`).join('\n')}\n\nReview \`src/data/commitments.ts\`.`,
      });
    }
  }
  return { issues, rows };
}
