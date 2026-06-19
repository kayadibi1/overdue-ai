import { describe, it, expect } from 'vitest';
import { statusMessage } from '../src/scripts/subscribe';

describe('statusMessage', () => {
  it('maps each status to copy, with a safe default', () => {
    expect(statusMessage('subscribed')).toMatch(/check your inbox/i);
    expect(statusMessage('already')).toMatch(/already/i);
    expect(statusMessage('invalid')).toMatch(/valid email/i);
    expect(statusMessage('boom')).toMatch(/something went wrong/i);
  });
});
