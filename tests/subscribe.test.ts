import { describe, it, expect, vi } from 'vitest';
import { normalizeEmail, mapButtondownResponse, subscribe } from '../server/subscribe/subscribe.mjs';
import { statusMessage } from '../src/scripts/subscribe';

describe('normalizeEmail', () => {
  it('trims + lowercases valid emails', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
  it('rejects junk, missing dot, oversize, non-strings', () => {
    expect(normalizeEmail('nope')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail('x'.repeat(250) + '@y.com')).toBeNull();
    expect(normalizeEmail(42 as unknown as string)).toBeNull();
  });
});

describe('mapButtondownResponse', () => {
  it('maps created/already/invalid/error', () => {
    expect(mapButtondownResponse(201, {}).status).toBe('subscribed');
    expect(mapButtondownResponse(400, { detail: 'already subscribed' }).status).toBe('already');
    expect(mapButtondownResponse(400, { detail: 'Enter a valid email address.' }).status).toBe('invalid');
    expect(mapButtondownResponse(500, {}).status).toBe('error');
  });
});

describe('subscribe', () => {
  it('POSTs to Buttondown with the token + email and maps the result', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 201, json: async () => ({}) });
    const res = await subscribe('a@b.com', { apiKey: 'KEY', fetchFn });
    expect(res.status).toBe('subscribed');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toMatch(/\/v1\/subscribers$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Token KEY');
    expect(JSON.parse(init.body).email_address).toBe('a@b.com');
  });
});

describe('statusMessage', () => {
  it('maps each status to copy, with a safe default', () => {
    expect(statusMessage('subscribed')).toMatch(/check your inbox/i);
    expect(statusMessage('already')).toMatch(/already/i);
    expect(statusMessage('invalid')).toMatch(/valid email/i);
    expect(statusMessage('boom')).toMatch(/something went wrong/i);
  });
});
