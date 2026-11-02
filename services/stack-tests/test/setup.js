import { afterAll, afterEach, beforeAll, inject } from 'vitest';
import mongoose from 'mongoose';

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${process.env.VITEST_POOL_ID}` });
});

afterEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
