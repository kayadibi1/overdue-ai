import { describe, it, expect } from 'vitest';
import { buildPrompt, parseVerdict } from '../scripts/lib/claude.mjs';

const COMMITMENT = {
  id: 'demo-commitment',
  title: 'Publish a model card for every frontier release',
  lab: 'OpenAI',
  sources: [
    { url: 'https://example.com/policy', role: 'context', quote: 'context quote, ignore' },
    { url: 'https://example.com/promise', role: 'obligation', quote: 'we will publish a model card for every frontier model' },
  ],
};

describe('buildPrompt', () => {
  it('includes the obligation quote, the title, and the JSON instruction', () => {
    const p = buildPrompt(COMMITMENT, 'some artifact text');
    expect(p).toContain('we will publish a model card for every frontier model');
    expect(p).toContain('Publish a model card for every frontier release');
    expect(p).toContain('"verdict"');
  });
});

describe('parseVerdict', () => {
  it('parses a realistic claude -p json envelope', () => {
    const stdout = JSON.stringify({
      type: 'result',
      result: '{"verdict":"met","rationale":"r","citation":"c"}',
    });
    expect(parseVerdict(stdout)).toEqual({ verdict: 'met', rationale: 'r', citation: 'c' });
  });

  it('extracts the JSON even when the model wraps it in prose', () => {
    const stdout = JSON.stringify({
      type: 'result',
      result: 'Here is my answer:\n{"verdict":"partial","rationale":"only half done","citation":"https://x"}\nThanks!',
    });
    expect(parseVerdict(stdout)).toEqual({
      verdict: 'partial',
      rationale: 'only half done',
      citation: 'https://x',
    });
  });

  it('returns null on garbage', () => {
    expect(parseVerdict('not json at all')).toBeNull();
  });

  it('returns null on a bad verdict value', () => {
    const stdout = JSON.stringify({
      type: 'result',
      result: '{"verdict":"maybe","rationale":"r","citation":"c"}',
    });
    expect(parseVerdict(stdout)).toBeNull();
  });
});
