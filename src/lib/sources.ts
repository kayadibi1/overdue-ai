import type { Commitment, Source } from './types';

export function primarySource(c: Commitment): Source {
  return c.sources.find(s => s.role === 'obligation') ?? c.sources[0];
}
