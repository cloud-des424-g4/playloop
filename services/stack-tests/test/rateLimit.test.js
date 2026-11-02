import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '@playloop/kit';

describe('createRateLimiter', () => {
  it('allows a fixed number of hits per key inside the window', () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(allow('login:ip')).toBe(true);
    expect(allow('login:ip')).toBe(true);
    expect(allow('login:ip')).toBe(false);
    expect(allow('login:other')).toBe(true);
  });
});
