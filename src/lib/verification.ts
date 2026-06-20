import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseVerification, type VerificationState } from './verify/schema';

// Runtime read (NOT a static `import` of the JSON): a static import is parsed by
// Vite at build time before any try/catch, so a malformed committed file would
// break the build. Reading at runtime makes a bad file degrade to "no badges".
// Use process.cwd() (repo root during `astro build` and in CI) rather than
// `new URL(..., import.meta.url)`, which Vite rewrites as an asset reference.
function load(): VerificationState {
  try {
    return parseVerification(JSON.parse(readFileSync(join(process.cwd(), 'src/data/verification.json'), 'utf8')));
  } catch {
    return { rows: {} };
  }
}
const state = load();
export const isUnderReview = (id: string): boolean => (state.rows[id]?.problems?.length ?? 0) > 0;
export const archiveFor = (id: string, url: string): string | undefined =>
  state.rows[id]?.sources.find((s) => s.url === url)?.archiveUrl;
export const lastChangedOn = (id: string): string | undefined => state.rows[id]?.lastChangedOn;
