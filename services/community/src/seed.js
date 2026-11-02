import { SEED_ACCOUNTS } from '@playloop/shared';
import { Member } from './modules/users/member.model.js';
import { Game } from './modules/games/game.model.js';
import { defaultForm } from './modules/games/game.defaults.js';
import { getConfig } from './modules/meta/config.service.js';

const games = [
  {
    _id: '7eed00000000000000000101',
    owner: SEED_ACCOUNTS[0]._id,
    title: 'Seed: Storm Island',
    pitch: 'Sample listing: explore an island and find shelter before the storm.',
    genres: ['survival', 'exploration'],
    coreGameplay: ['Explore the island', 'Find shelter'],
  },
  {
    _id: '7eed00000000000000000102',
    owner: SEED_ACCOUNTS[1]._id,
    title: 'Seed: Forest Mystery',
    pitch: 'Sample listing: follow clues through a mysterious forest.',
    genres: ['adventure', 'mystery'],
    coreGameplay: ['Collect clues', 'Solve the forest mystery'],
  },
];

// Only insert missing seed records. Never overwrite edits.
export async function seedCommunity() {
  await Member.init();
  const createdMembers = [];
  for (const { _id, username, email, role } of SEED_ACCOUNTS) {
    if (await Member.exists({ _id })) continue;
    await Member.create({
      _id,
      username,
      email,
      role,
      displayName: username.replace('seed_', 'Demo '),
      bio: 'Sample account created by the PlayLoop seed script.',
    });
    createdMembers.push(email);
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
  return { createdMembers, createdGames };
}
