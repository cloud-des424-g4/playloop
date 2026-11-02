import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function setup(project) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide('mongoUri', replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
