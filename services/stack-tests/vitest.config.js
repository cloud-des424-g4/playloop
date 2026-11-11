import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.js'],
    setupFiles: ['./test/setup.js'],
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_SECRET: 'test-secret',
      CLIENT_ORIGIN: 'http://localhost:5173',
      MEDIA_CDN_URL: 'http://media.test',
      PLAY_CDN_URL: 'http://play.test/playloop-local-play',
      INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret-0123456789abcdef',
      INTERNAL_SERVICE_SECRET: 'test-service-secret',
    },
  },
});
