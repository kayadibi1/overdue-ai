import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseVerification, type VerificationState } from './verify/schema';

function load(): VerificationState {
  try {
    const path = fileURLToPath(new URL('../data/verification.json', import.meta.url));
    return parseVerification(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return { rows: {} };
  }
}
const state = load();
export const isUnderReview = (id: string): boolean => (state.rows[id]?.problems?.length ?? 0) > 0;
export const archiveFor = (id: string, url: string): string | undefined =>
  state.rows[id]?.sources.find((s) => s.url === url)?.archiveUrl;
export const lastChangedOn = (id: string): string | undefined => state.rows[id]?.lastChangedOn;
