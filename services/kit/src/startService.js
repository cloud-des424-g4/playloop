import { connectDb, disconnectDb } from './db.js';
import { assertEnv, env } from './env.js';
import { logger } from './logger.js';

export async function startService({ name, defaultPort, createApp, onStart, onStop }) {
  assertEnv();
  await connectDb(process.env.MONGODB_URI);
  await onStart?.();

  const port = Number(process.env.PORT || defaultPort);
  const server = createApp().listen(port, () => {
    logger.info({ service: name, port, env: env.nodeEnv }, 'Service listening');
  });

  function shutdown(signal) {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await onStop?.();
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
