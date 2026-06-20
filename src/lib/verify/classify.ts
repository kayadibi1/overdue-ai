export function normalize(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}
export function classifyQuote(pageText: string, quote: string, prevOk: boolean): 'ok' | 'inconclusive' | 'drifted' {
  if (normalize(pageText).includes(normalize(quote))) return 'ok';
  return prevOk ? 'drifted' : 'inconclusive';
}
