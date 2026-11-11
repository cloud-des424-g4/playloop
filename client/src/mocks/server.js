import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

// Used by Vitest (see src/test/setup.js).
export const server = setupServer(...handlers);
