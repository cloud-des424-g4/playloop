import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { msw } from 'msw/vite';

// The API listens on :4000 (see server/.env.example). Proxying /api keeps requests same-origin in
// development, which mirrors the Amplify rewrite used in production and lets the session cookie work.
//
// msw() serves mockServiceWorker.js from the installed msw package while the dev server runs. It adds
// the file to a build only when the app imports `virtual:msw`, which it does not, so production
// builds carry no worker script (src/main.jsx loads the mocks in development only).
export default defineConfig({
  plugins: [react(), msw()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    testTimeout: 10_000,
  },
});
