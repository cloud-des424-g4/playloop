import { levelFor } from '@playloop/shared';
import { Game } from '../games/game.model.js';
import { getConfig, runtimeConfig } from '../meta/config.service.js';
import { notify } from '../notifications/notification.service.js';
import { Review } from '../reviews/review.model.js';
import { User } from '../users/user.model.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { ReputationEvent } from './reputation-event.model.js';

const levels = () => runtimeConfig().levels;
const pointsTable = () => runtimeConfig().reputationPoints;

export const votePoints = (value) =>
  value === 1 ? pointsTable().helpfulVote : pointsTable().notHelpfulVote;

export const feedbackPoints = (status) =>
  ({ planned: pointsTable().feedbackPlanned, fixed: pointsTable().feedbackFixed })[status] ?? 0;

export async function adjustReputation(userId, delta, event, session) {
  if (!delta) return { applied: 0 };
  const user = await User.findById(userId).session(session);
  if (!user) return { applied: 0 };
  const before = user.reputationPoints;
  const after = Math.max(0, before + delta);
  const applied = after - before;
  if (!applied) return { before, after, applied: 0, user };
  user.reputationPoints = after;
  await user.save({ session });
  await ReputationEvent.create([{ user: userId, points: applied, ...event }], { session });
  return { before, after, applied, user };
}

export async function reverseReviewReputation(reviewId, session) {
  const events = await ReputationEvent.find({ review: reviewId }).session(session);
  const byUser = new Map();
  for (const event of events) {
    const key = event.user.toString();
    byUser.set(key, (byUser.get(key) ?? 0) + event.points);
  }
  for (const [userId, sum] of byUser) {
    if (!sum) continue;
    const user = await User.findById(userId).session(session);
    if (!user) continue;
    user.reputationPoints = Math.max(0, user.reputationPoints - sum);
    await user.save({ session });
  }
  await ReputationEvent.deleteMany({ review: reviewId }).session(session);
}

export async function awardAchievements(userId, session) {
  const config = await getConfig();
  const user = await User.findById(userId).session(session);
  if (!user) return [];
  const counts = await achievementCounts(userId, session);
  const earned = [];
  for (const badge of config.badges) {
    if (!badge.active || badge.kind !== 'achievement' || badge.threshold == null) continue;
    if (user.badges.some((item) => item.key === badge.key)) continue;
    if ((counts[badge.key] ?? 0) < badge.threshold) continue;
    user.badges.push({ key: badge.key, awardedAt: new Date() });
    earned.push(badge);
  }
  if (earned.length) await user.save({ session });
  return earned;
}

const useSession = (query, session) => (session ? query.session(session) : query);

async function achievementCounts(userId, session) {
  const reviewer = userId;
  const base = { reviewer, status: 'submitted', removedAt: null };
  const [reviews, rouletteReviews, games, helpful, fixed] = await Promise.all([
    useSession(Review.countDocuments(base), session),
    useSession(Review.countDocuments({ ...base, origin: 'roulette' }), session),
    useSession(
      Game.countDocuments({
        owner: userId,
        status: 'published',
        deletedAt: null,
        removedAt: null,
      }),
      session,
    ),
    useSession(
      Review.aggregate([
        { $match: base },
        { $group: { _id: null, total: { $sum: '$helpfulCount' } } },
      ]),
      session,
    ),
    useSession(Review.countDocuments({ ...base, feedbackStatus: 'fixed' }), session),
  ]);
  return {
    first_launch: games,
    first_review: reviews,
    thoughtful_critic: reviews,
    helping_hand: helpful[0]?.total ?? 0,
    bug_hunter: fixed,
    roulette_regular: rouletteReviews,
  };
}

export async function notifyProgress(userId, { before, after, badges }, link, session) {
  if (before != null && after != null) {
    const previous = levelFor(before, levels());
    const next = levelFor(after, levels());
    if (next.level > previous.level) {
      await notify(
        {
          user: userId,
          type: 'level_up',
          message: `You reached level ${next.level}, ${next.title}`,
          link,
        },
        session,
      );
    }
  }
  for (const badge of badges ?? []) {
    await notify(
      {
        user: userId,
        type: 'badge_awarded',
        message: `You earned the ${badge.name} badge`,
        link,
      },
      session,
    );
  }
}

async function syncHallOfFame() {
  const config = await getConfig();
  const definition = config.badges.find((badge) => badge.key === 'hall_of_fame' && badge.active);
  if (!definition) return;
  const top = await User.find({ reputationPoints: { $gt: 0 }, status: { $ne: 'banned' } })
    .sort({ reputationPoints: -1, createdAt: 1 })
    .limit(definition.threshold ?? 10);
  await User.updateMany(
    { 'badges.key': 'hall_of_fame', _id: { $nin: top.map((user) => user._id) } },
    { $pull: { badges: { key: 'hall_of_fame' } } },
  );
  for (const user of top) {
    if (user.badges.some((badge) => badge.key === 'hall_of_fame')) continue;
    user.badges.push({ key: 'hall_of_fame', awardedAt: new Date() });
    await user.save();
    await notify({
      user: user._id,
      type: 'badge_awarded',
      message: 'You earned the Hall of Fame badge',
      link: '/leaderboard',
    });
  }
}

export async function awardReviewerOfTheMonth() {
  const config = await getConfig();
  const definition = config.badges.find(
    (badge) => badge.key === 'reviewer_of_the_month' && badge.active,
  );
  if (!definition) return;
  const period = previousMonth();
  const awarded = { key: definition.key, period };
  if (await User.exists({ badges: { $elemMatch: awarded } })) return;

  const [leader] = await monthStandings(1, period);
  if (!leader) return;
  const { modifiedCount } = await User.updateOne(
    { _id: leader._id, badges: { $not: { $elemMatch: awarded } } },
    { $push: { badges: { ...awarded, awardedAt: new Date() } } },
  );
  if (!modifiedCount) return;
  await notify({
    user: leader._id,
    type: 'badge_awarded',
    message: `You earned Reviewer of the Month for ${period}`,
    link: '/leaderboard',
  });
}

function currentMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function monthStart(month = currentMonth(), offset = 0) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1 + offset, 1));
}

const previousMonth = () => currentMonth(monthStart(currentMonth(), -1));

async function monthStandings(limit, month = currentMonth()) {
  return ReputationEvent.aggregate([
    { $match: { createdAt: { $gte: monthStart(month), $lt: monthStart(month, 1) } } },
    { $group: { _id: '$user', points: { $sum: '$points' } } },
    { $match: { points: { $gt: 0 } } },
    { $sort: { points: -1 } },
    { $limit: limit },
  ]);
}

export async function getLeaderboard(period = 'all_time', limit = 10) {
  await syncHallOfFame();
  if (period === 'month') {
    const rows = await monthStandings(limit);
    const users = await User.find({ _id: { $in: rows.map((row) => row._id) } }).select(
      USER_SUMMARY_FIELDS,
    );
    const byId = new Map(users.map((user) => [user._id.toString(), user]));
    return {
      period,
      month: currentMonth(),
      items: rows
        .filter((row) => byId.has(row._id.toString()))
        .map((row, index) => ({
          rank: index + 1,
          user: toUserSummary(byId.get(row._id.toString())),
          points: row.points,
        })),
    };
  }

  const users = await User.find({ reputationPoints: { $gt: 0 }, status: { $ne: 'banned' } })
    .sort({ reputationPoints: -1, createdAt: 1 })
    .limit(limit)
    .select(USER_SUMMARY_FIELDS);
  return {
    period,
    items: users.map((user, index) => ({
      rank: index + 1,
      user: toUserSummary(user),
      points: user.reputationPoints,
    })),
  };
}
