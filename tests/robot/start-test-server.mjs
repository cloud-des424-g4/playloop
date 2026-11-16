// Optional isolated fallback: reuse the same real MongoDB replica-set package as Vitest.
// No existing database, .env file, existing account, or storage service is used.
import { randomBytes } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.ROBOT_PORT || '4000';
process.env.MONGODB_URI = mongo.getUri('playloop-robot');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.LOG_LEVEL = 'error';
// Same synthetic URL configuration as server/vitest.config.js; no remote assets are fetched.
process.env.MEDIA_CDN_URL = 'http://media.test';
process.env.PLAY_CDN_URL = 'http://play.test/playloop-local-play';
const { connectDb, disconnectDb } = await import('../../server/src/config/db.js');
const { createApp } = await import('../../server/src/app.js');
await connectDb(process.env.MONGODB_URI);
// Reuse existing backend fixtures; these records exist only in this temporary replica set.
const { register } = await import('../../server/src/modules/auth/auth.service.js');
const { createPublishedGame } = await import('../../server/test/helpers.js');
const { Game } = await import('../../server/src/modules/games/game.model.js');
const owner = await register({
  username: 'robotfixture',
  email: 'robotfixture@example.com',
  password: 'Robot-Fixture-Only-42',
});
await createPublishedGame(owner, { title: 'Robot Tempest' });
await createPublishedGame(owner, { title: 'Robot Undertow', genres: ['horror'] });
await Game.create({ owner: owner._id, title: 'Robot Secret Draft', status: 'draft' });
const server = createApp().listen(Number(process.env.PORT), '127.0.0.1', () => {
  console.log(
    `Robot test API ready at http://localhost:${process.env.PORT}/api/docs/ (isolated MongoDB)`,
  );
});
async function shutdown() {
  server.close(async () => {
    await disconnectDb();
    await mongo.stop();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Allows this test-only process to cleanly release MongoDB in non-interactive runners.
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
  if (data.trim() === 'stop') shutdown();
});
