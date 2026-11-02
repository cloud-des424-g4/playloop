import { randomBytes } from 'node:crypto';
import { connectDb, disconnectDb } from '@playloop/kit';
import { seedAccounts } from '../src/seed.js';

try {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled when NODE_ENV=production.');
  }
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in services/identity/.env first.');
  const password = process.env.SEED_PASSWORD || randomBytes(18).toString('base64url');
  await connectDb(process.env.MONGODB_URI);
  const { createdUsers } = await seedAccounts(password);
  console.log(`Seed complete: ${createdUsers.length} accounts created.`);
  if (createdUsers.length) {
    console.log('New accounts:', createdUsers.join(', '));
    console.log('Password for these new demo accounts:', password);
    console.log('Save this password. Rerunning seed does not reset existing passwords.');
  }
} catch (error) {
  // Do not print connection errors that might contain credentials from the URI.
  console.error(`Seed failed (${error.name}). Check database access and seed configuration.`);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
