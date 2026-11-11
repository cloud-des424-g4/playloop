import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { resetMockDb } from '../mocks/db.js';
import { server } from '../mocks/server.js';

// Node's fetch rejects relative URLs, but the API client calls `/api/...`. Resolve them against the
// jsdom origin, as a browser would. Tests that stub fetch themselves replace this wrapper.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  nativeFetch(
    typeof input === 'string' && input.startsWith('/') ? new URL(input, location.origin) : input,
    init,
  );

// findBy* and waitFor give up after 1 s by default, which a busy machine can exceed even when the
// UI is fine. Tests should not depend on real delays (see auth.test.jsx), this is only headroom.
configure({ asyncUtilTimeout: 3000 });

// Fail on requests no handler covers, so a missing mock shows up as a test failure.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(() => server.close());
