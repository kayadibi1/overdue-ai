import { describe, it, expect } from 'vitest';
import { normalize, classifyQuote } from '../src/lib/verify/classify';

describe('normalize', () => {
  it('collapses whitespace, straightens curly quotes, and lowercases', () => {
    expect(normalize('  Hello   World  ')).toBe('hello world');
    expect(normalize('“smart” quotes')).toBe('"smart" quotes');
    expect(normalize('it’s ‘nested’')).toBe("it's 'nested'");
    expect(normalize('A\n\tB')).toBe('a b');
  });
});

describe('classifyQuote', () => {
  const page = 'We “solemnly” pledge to PUBLISH our   framework by 2026.';
  const quote = 'we "solemnly" pledge to publish our framework';

  it("returns 'ok' when the normalized quote is present", () => {
    expect(classifyQuote(page, quote, false)).toBe('ok');
    expect(classifyQuote(page, quote, true)).toBe('ok');
  });
  it("returns 'drifted' when absent AND prevOk=true", () => {
    expect(classifyQuote('totally different text', quote, true)).toBe('drifted');
  });
  it("returns 'inconclusive' when absent AND prevOk=false", () => {
    expect(classifyQuote('totally different text', quote, false)).toBe('inconclusive');
  });
});
