export interface Update {
  id: string;            // stable slug, unique, used as feed <guid> and #anchor, e.g. '2026-06-18-launch'
  date: string;          // 'YYYY-MM-DD' UTC, the publish date
  title: string;         // one line
  body: string;          // 1–3 sentences, plain text (no HTML); links expressed via the fields below
  commitmentIds?: string[]; // optional refs into COMMITMENTS (renders links on /updates)
  sourceUrl?: string;    // optional source (internal path or external URL)
  sourceLabel?: string;  // label for sourceUrl
  kind?: 'update' | 'correction'; // default 'update'; 'correction' = a ruling change / data fix (shown on /corrections)
}

export const UPDATES: Update[] = [
  {
    id: '2026-06-18-launch',
    date: '2026-06-18',
    title: 'Overdue launches',
    body:
      'A tracker of the public safety commitments frontier AI labs made — RSPs, frontier safety frameworks, and the Seoul and White House commitments — each with its deadline and an explicit upcoming/overdue status. See how it differs from existing trackers on the methodology page.',
    sourceUrl: '/methodology',
    sourceLabel: 'Methodology',
  },
];
