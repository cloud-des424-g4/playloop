import { connectDb, disconnectDb } from '@playloop/kit';
import { seedCommunity } from '../src/seed.js';

try {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled when NODE_ENV=production.');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI in services/community/.env first.');
  }
  await connectDb(process.env.MONGODB_URI);
  const { createdMembers, createdGames } = await seedCommunity();
  console.log(`Seed complete: ${createdMembers.length} members and ${createdGames} games created.`);
  console.log('Existing records were preserved. Game URLs are placeholders, not playable builds.');
} catch (error) {
  // Do not print connection errors that might contain credentials from the URI.
  console.error(`Seed failed (${error.name}). Check database access and seed configuration.`);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
