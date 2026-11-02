import { BADGES, levelFor } from '@playloop/shared';
import { ApiError } from '@playloop/kit';
import { mediaUrl } from '../../utils/mediaUrl.js';
import { activeGenreKeys, getConfig } from '../meta/config.service.js';
import { takeUpload } from '../media/media.client.js';
import { Game } from '../games/game.model.js';
import { Review } from '../reviews/review.model.js';
import { Member } from './member.model.js';

export const USER_SUMMARY_FIELDS = 'username displayName avatarKey reputationPoints';

export function toUserSummary(user) {
  const { level, title } = levelFor(user.reputationPoints ?? 0);
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    avatarUrl: mediaUrl(user.avatarKey),
    level,
    levelTitle: title,
  };
}

function toReputation(points = 0) {
  const level = levelFor(points);
  return {
    points,
    level: level.level,
    title: level.title,
    levelMinPoints: level.minPoints,
    nextLevelMinPoints: level.nextLevelMinPoints,
  };
}

function toBadges(user) {
  return (user.badges ?? []).flatMap((badge) => {
    const definition = BADGES.find((item) => item.key === badge.key);
    if (!definition) return [];
    return [
      {
        key: definition.key,
        name: definition.name,
        description: definition.description,
        kind: definition.kind,
        ...(badge.awardedAt && { awardedAt: badge.awardedAt }),
        ...(badge.period && { period: badge.period }),
      },
    ];
  });
}

async function loadStats(userId) {
  const [reviewsWritten, gamesPublished, helpful] = await Promise.all([
    Review.countDocuments({ reviewer: userId, status: 'submitted' }),
    Game.countDocuments({ owner: userId, status: 'published', deletedAt: null }),
    Review.aggregate([
      { $match: { reviewer: userId, status: 'submitted' } },
      { $group: { _id: null, total: { $sum: '$helpfulCount' } } },
    ]),
  ]);
  return {
    reviewsWritten,
    gamesPublished,
    helpfulVotes: helpful[0]?.total ?? 0,
  };
}

function toProfile(user, stats) {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    pronouns: user.pronouns,
    bio: user.bio,
    avatarUrl: mediaUrl(user.avatarKey),
    favoriteGenres: [...user.favoriteGenres],
    platforms: [...user.platforms],
    links: user.links.map(({ label, url }) => ({ label, url })),
    joinedAt: user.createdAt,
    reputation: toReputation(user.reputationPoints),
    badges: toBadges(user),
    stats,
  };
}

export async function toMe(user) {
  return {
    ...(await toPublicFields(user)),
    email: user.email,
    role: user.role,
  };
}

async function toPublicFields(user) {
  return toProfile(user, await loadStats(user._id));
}

const upsertMember = (id, { username, email, role }) =>
  Member.findByIdAndUpdate(
    id,
    { $setOnInsert: { username, email, role, displayName: username } },
    { upsert: true, returnDocument: 'after' },
  );

export async function ensureMember(id, account) {
  try {
    return await toMe(await upsertMember(id, account));
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  // A registration whose reply was lost leaves a Member with no User behind it.
  await Member.deleteMany({
    _id: { $ne: id },
    $or: [{ username: account.username }, { email: account.email }],
  }).collation({ locale: 'en', strength: 2 });
  return toMe(await upsertMember(id, account));
}

export async function getMe(userId) {
  const user = await Member.findById(userId);
  if (!user) throw ApiError.unauthorized();
  return toMe(user);
}

export async function updateMe(userId, input) {
  const user = await Member.findById(userId);
  if (!user) throw ApiError.unauthorized();

  if (input.avatarUploadId) {
    const upload = await takeUpload(input.avatarUploadId, userId, 'avatar');
    user.avatarKey = upload.key;
  }

  await getConfig();
  if (input.favoriteGenres) {
    const unknown = input.favoriteGenres.filter((genre) => !activeGenreKeys().includes(genre));
    if (unknown.length) {
      throw ApiError.validation('Some fields are invalid', [
        { path: '/body/favoriteGenres', message: `Unknown genres: ${unknown.join(', ')}` },
      ]);
    }
  }

  const { avatarUploadId, ...fields } = input;
  if (avatarUploadId === null) user.avatarKey = null;
  user.set(fields);
  await user.save();
  return toMe(user);
}

export async function findByUsername(username) {
  const user = await Member.findOne({ username }).collation({ locale: 'en', strength: 2 });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function getPublicProfile(username, viewerId) {
  const user = await findByUsername(username);
  return {
    ...(await toPublicFields(user)),
    isMe: Boolean(viewerId) && user._id.equals(viewerId),
  };
}
