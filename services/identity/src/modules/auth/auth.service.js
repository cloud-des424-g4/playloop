import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { accountBlockMessage, ApiError, env, logger } from '@playloop/kit';
import { User } from '../accounts/user.model.js';
import { PasswordReset } from './password-reset.model.js';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = new Set([
  'admin',
  'administrator',
  'help',
  'moderator',
  'official',
  'playloop',
  'root',
  'staff',
  'support',
  'system',
]);
const RESET_TTL_MS = 60 * 60 * 1000;

let dummyHash;

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function passwordMatches(password, hash) {
  dummyHash ??= await hashPassword('playloop-dummy-password');
  return bcrypt.compare(password, hash ?? dummyHash);
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function findByIdentifier(identifier) {
  if (identifier.includes('@')) {
    return User.findOne({ email: identifier.toLowerCase() }).select('+passwordHash');
  }
  return User.findOne({ username: identifier })
    .collation({ locale: 'en', strength: 2 })
    .select('+passwordHash');
}

export async function checkUsername(raw) {
  const username = raw.trim();
  if (!USERNAME_RE.test(username)) return { username, available: false, reason: 'invalid' };
  if (RESERVED.has(username.toLowerCase()))
    return { username, available: false, reason: 'reserved' };
  const taken = await User.findOne({ username })
    .collation({ locale: 'en', strength: 2 })
    .select('_id');
  if (taken) return { username, available: false, reason: 'taken' };
  return { username, available: true };
}

export async function register({ username, email, password }) {
  const availability = await checkUsername(username);
  if (!availability.available) {
    if (availability.reason === 'taken') throw ApiError.conflict('username is already taken');
    throw ApiError.validation('Some fields are invalid', [
      {
        path: '/body/username',
        message:
          availability.reason === 'reserved' ? 'This username is reserved' : 'Username is invalid',
      },
    ]);
  }

  const normalizedEmail = email.toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    throw ApiError.conflict('email is already taken');
  }

  try {
    return await User.create({
      username,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
    });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern ?? {})[0] ?? 'username';
      throw ApiError.conflict(`${field} is already taken`);
    }
    throw err;
  }
}

export async function login({ email, password }) {
  const user = await findByIdentifier(email.trim());
  const matches = await passwordMatches(password, user?.passwordHash);
  if (!user || !matches) throw ApiError.unauthorized('Email or password is incorrect');
  const reason = accountBlockMessage(user);
  if (reason) throw ApiError.forbidden(reason);
  return user;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized();
  if (!(await passwordMatches(currentPassword, user.passwordHash))) {
    throw ApiError.validation('Some fields are invalid', [
      { path: '/body/currentPassword', message: 'Current password is incorrect' },
    ]);
  }
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}

function resetLink(token) {
  return `${env.clientOrigins[0]}/reset-password?token=${token}`;
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await mongoose.connection.transaction(async (session) => {
    await PasswordReset.updateMany(
      { user: user._id, usedAt: null },
      { usedAt: new Date() },
      { session },
    );
    await PasswordReset.create([{ user: user._id, tokenHash: hashToken(token), expiresAt }], {
      session,
    });
  });

  if (env.isProduction) {
    logger.warn({ email: user.email }, 'Password reset email was not sent; no mail transport yet');
  } else {
    logger.info({ email: user.email, link: resetLink(token) }, 'Password reset link');
  }
  return token;
}

export async function resetPassword({ token, password }) {
  const record = await PasswordReset.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw ApiError.validation('Reset link is invalid or has expired');

  const user = await User.findById(record.user).select('+passwordHash');
  if (!user) throw ApiError.validation('Reset link is invalid or has expired');

  await mongoose.connection.transaction(async (session) => {
    user.passwordHash = await hashPassword(password);
    record.usedAt = new Date();
    await user.save({ session });
    await record.save({ session });
  });
}
