import bcrypt from 'bcrypt';
import { SEED_ACCOUNTS } from '@playloop/shared';
import { User } from './modules/accounts/user.model.js';

// Only insert missing seed records. Never overwrite edits or reset passwords.
export async function seedAccounts(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('SEED_PASSWORD must be at least 12 characters and at most 72 bytes.');
  }

  for (const account of SEED_ACCOUNTS) {
    const collision = await User.findOne({
      _id: { $ne: account._id },
      $or: [{ username: account.username }, { email: account.email }],
    }).collation({ locale: 'en', strength: 2 });
    if (collision)
      throw new Error(`Seed username/email already belongs to another user: ${account.username}`);
  }

  await User.init();
  const createdUsers = [];
  for (const account of SEED_ACCOUNTS) {
    if (await User.exists({ _id: account._id })) continue;
    await User.create({ ...account, passwordHash: await bcrypt.hash(password, 10) });
    createdUsers.push(account.email);
  }
  return { createdUsers };
}
