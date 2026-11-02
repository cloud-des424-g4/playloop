import { expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { seedCommunity } from '../../community/src/seed.js';
import { seedAccounts } from '../../identity/src/seed.js';
import { User } from '../../identity/src/modules/accounts/user.model.js';
import { Game } from '../../community/src/modules/games/game.model.js';
import { Config } from '../../community/src/modules/meta/config.model.js';

it('creates login-ready accounts and linked listings, preserving edits on rerun', async () => {
  const password = 'Seed-test-password-123';
  const first = await seedAccounts(password);
  const community = await seedCommunity();
  expect(first.createdUsers).toHaveLength(4);
  expect(community.createdMembers).toHaveLength(4);
  expect(community.createdGames).toBe(2);
  const user = await User.findOne({ username: 'seed_developer' }).select('+passwordHash');
  expect(await bcrypt.compare(password, user.passwordHash)).toBe(true);
  expect(user.role).toBe('user');
  const game = await Game.findOne({ owner: user._id }).populate('owner');
  expect(game.owner.email).toBe(user.email);
  expect(game.form.firstImpression.questions.length).toBeGreaterThan(0);
  game.title = 'My edited title';
  await game.save();
  expect(await seedAccounts('Another-password-123')).toEqual({ createdUsers: [] });
  expect(await seedCommunity()).toEqual({ createdMembers: [], createdGames: 0 });
  expect(await User.countDocuments()).toBe(4);
  expect(await Game.countDocuments()).toBe(2);
  expect((await Game.findById(game._id)).title).toBe('My edited title');
  const unchanged = await User.findById(user._id).select('+passwordHash');
  expect(unchanged.passwordHash).toBe(user.passwordHash);
  expect(await Config.countDocuments()).toBe(1);
}, 20000);

it('refuses to reuse an existing account with a seed email', async () => {
  await User.create({
    username: 'existing_user',
    email: 'developer@seed.example.com',
    passwordHash: 'existing-hash',
  });
  await expect(seedAccounts('Seed-test-password-123')).rejects.toThrow('another user');
  expect(await User.countDocuments()).toBe(1);
  expect(await Game.countDocuments()).toBe(0);
});
