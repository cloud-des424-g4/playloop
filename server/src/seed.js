import bcrypt from 'bcrypt';
import { User } from './modules/users/user.model.js';
import { Game } from './modules/games/game.model.js';
import { defaultForm } from './modules/games/game.defaults.js';
import { getConfig } from './modules/meta/config.service.js';

const users = [
  {
    _id: '7eed00000000000000000001',
    username: 'seed_developer',
    email: 'developer@seed.example.com',
  },
  { _id: '7eed00000000000000000002', username: 'seed_creator', email: 'creator@seed.example.com' },
  { _id: '7eed00000000000000000003', username: 'seed_tester', email: 'tester@seed.example.com' },
];

const games = [
  {
    _id: '7eed00000000000000000101',
    owner: users[0]._id,
    title: 'Seed: Storm Island',
    pitch: 'Sample listing: explore an island and find shelter before the storm.',
    genres: ['survival', 'exploration'],
    coreGameplay: ['Explore the island', 'Find shelter'],
  },
  {
    _id: '7eed00000000000000000102',
    owner: users[1]._id,
    title: 'Seed: Forest Mystery',
    pitch: 'Sample listing: follow clues through a mysterious forest.',
    genres: ['adventure', 'mystery'],
    coreGameplay: ['Collect clues', 'Solve the forest mystery'],
  },
];

// Only insert missing seed records. Never overwrite edits or reset passwords.
export async function seedDemoData(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('SEED_PASSWORD must be at least 12 characters and at most 72 bytes.');
  }

  for (const user of users) {
    const collision = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ username: user.username }, { email: user.email }],
    }).collation({ locale: 'en', strength: 2 });
    if (collision)
      throw new Error(`Seed username/email already belongs to another user: ${user.username}`);
  }

  await User.init();
  const createdUsers = [];
  for (const user of users) {
    if (await User.exists({ _id: user._id })) continue;
    await User.create({
      ...user,
      displayName: user.username.replace('seed_', 'Demo '),
      passwordHash: await bcrypt.hash(password, 10),
      role: 'user',
      bio: 'Sample account created by the PlayLoop seed script.',
    });
    createdUsers.push(user.email);
  }

  let createdGames = 0;
  for (const game of games) {
    if (await Game.exists({ _id: game._id })) continue;
    const form = defaultForm();
    form.playtest.missions = [{ id: 'seed-mission', title: 'Explore the first area', minutes: 5 }];
    form.playtest.knownIssues = ['Demo data only: no playable build or media is provided.'];
    await Game.create({
      ...game,
      status: 'published',
      platforms: ['web'],
      buildStage: 'prototype',
      engine: 'godot',
      version: '0.1',
      delivery: { method: 'web', webUrl: 'https://example.com' },
      devNotes: 'Seed listing only. Replace the placeholder URL with your own playable game.',
      playable: ['Sample first area'],
      form,
      publishedAt: new Date(),
      lastUpdatedAt: new Date(),
    });
    createdGames += 1;
  }

  await getConfig();
  return { createdUsers, createdGames };
}
