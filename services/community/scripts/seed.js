import { randomBytes } from 'node:crypto';
import { connectDb, disconnectDb } from '@playloop/kit';
import { seedDemoData } from '../src/seed.js';

try {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled when NODE_ENV=production.');
  }
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env first.');
  const password = process.env.SEED_PASSWORD || randomBytes(18).toString('base64url');
  await connectDb(process.env.MONGODB_URI);
  const result = await seedDemoData(password);
  console.log(
    `Seed complete: ${result.createdUsers.length} users and ${result.createdGames} games created.`,
  );
  if (result.createdUsers.length) {
    console.log('New accounts:', result.createdUsers.join(', '));
    console.log('Password for these new demo accounts:', password);
    console.log('Save this password. Rerunning seed does not reset existing passwords.');
  }
  console.log('Existing records were preserved. Game URLs are placeholders, not playable builds.');
} catch (error) {
  // Do not print connection errors that might contain credentials from the URI.
  console.error(`Seed failed (${error.name}). Check database access and seed configuration.`);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
