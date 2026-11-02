import mongoose from 'mongoose';
import { ApiError, internalClient } from '@playloop/kit';
import { Reply, Reaction } from '../discussions/discussion.model.js';
import { listFeatured, setFeatured, visible } from '../games/discovery.service.js';
import { Featured } from '../games/featured.model.js';
import { Game } from '../games/game.model.js';
import { toGameCard } from '../games/game.service.js';
import { notify } from '../outbox/outbox.service.js';
import { saveChanges } from '../../utils/saveChanges.js';
import { getConfig, toConfig, updateConfig } from '../meta/config.service.js';
import { reverseReviewReputation } from '../reputation/reputation.service.js';
import { Report } from '../reports/report.model.js';
import { listReports, resolveReport as closeReport } from '../reports/report.service.js';
import { Review } from '../reviews/review.model.js';
import { Vote } from '../votes/vote.model.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { Member } from '../users/member.model.js';
import { ModerationAction } from './moderation.model.js';

const identity = internalClient('IDENTITY_URL');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function record(actor, action, targetType, targetId, extra = {}, session = null) {
  return ModerationAction.create([{ actor, action, targetType, targetId, ...extra }], {
    session,
  });
}

function toModerationAction(action) {
  return {
    id: action._id.toString(),
    action: action.action,
    targetType: action.targetType,
    targetId: action.targetId.toString(),
    actor: toUserSummary(action.actor),
    reason: action.reason ?? null,
    ...(action.until && { until: action.until }),
    ...(action.role && { role: action.role }),
    createdAt: action.createdAt,
  };
}

const setAccess = (userId, access) => identity.put(`/internal/accounts/${userId}/access`, access);

function liftExpiredSuspensions() {
  return Member.updateMany(
    { status: 'suspended', 'suspension.until': { $lte: new Date() } },
    { status: 'active', $unset: { suspension: 1 } },
  );
}

export async function stats(days = 30) {
  await liftExpiredSuspensions();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const [
    users,
    suspendedUsers,
    bannedUsers,
    games,
    publishedGames,
    submittedReviews,
    inProgressReviews,
    replies,
    openReports,
    newUsers,
    newGames,
    newReviews,
    newReports,
  ] = await Promise.all([
    Member.countDocuments(),
    Member.countDocuments({ status: 'suspended' }),
    Member.countDocuments({ status: 'banned' }),
    Game.countDocuments({ deletedAt: null, removedAt: null }),
    Game.countDocuments({ status: 'published', deletedAt: null, removedAt: null }),
    Review.countDocuments({ status: 'submitted', removedAt: null }),
    Review.countDocuments({ status: 'in_progress', removedAt: null }),
    Reply.countDocuments({ removedAt: null }),
    Report.countDocuments({ status: 'open' }),
    Member.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Game.aggregate([
      { $match: { publishedAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Review.aggregate([
      { $match: { status: 'submitted', submittedAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const tally = (rows) => new Map(rows.map((row) => [row._id, row.count]));
  const usersByDay = tally(newUsers);
  const gamesByDay = tally(newGames);
  const reviewsByDay = tally(newReviews);
  const reportsByDay = tally(newReports);
  const daily = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const key = dayKey(date);
    daily.push({
      date: key,
      newUsers: usersByDay.get(key) ?? 0,
      newGames: gamesByDay.get(key) ?? 0,
      submittedReviews: reviewsByDay.get(key) ?? 0,
      reports: reportsByDay.get(key) ?? 0,
    });
  }

  return {
    totals: {
      users,
      suspendedUsers,
      bannedUsers,
      games,
      publishedGames,
      submittedReviews,
      inProgressReviews,
      replies,
      openReports,
    },
    daily,
  };
}

async function loadModerationTarget(targetType, targetId) {
  const model = { game: Game, review: Review, reply: Reply }[targetType];
  const doc = await model.findById(targetId);
  if (!doc || doc.removedAt) throw ApiError.notFound('Content not found');
  return doc;
}

function ownerId(targetType, doc) {
  if (targetType === 'game') return doc.owner;
  if (targetType === 'review') return doc.reviewer;
  return doc.author;
}

export async function hideContent(targetType, targetId, reason, adminId) {
  const doc = await loadModerationTarget(targetType, targetId);
  const alreadyHidden = Boolean(doc.hiddenAt);
  doc.hiddenAt = new Date();
  doc.moderationReason = reason;
  await doc.save();
  await record(adminId, 'hide', targetType, doc._id, { reason });
  if (!alreadyHidden && targetType === 'review' && doc.status === 'submitted') {
    await Game.updateOne({ _id: doc.game }, { $inc: { reviewCount: -1 } });
  }
  if (!alreadyHidden && targetType === 'reply') {
    await Review.updateOne({ _id: doc.review }, { $inc: { replyCount: -1 } });
  }
  if (!alreadyHidden)
    await notify({
      user: ownerId(targetType, doc),
      type: 'content_hidden',
      message: `A moderator hid your ${targetType}: ${reason}`,
      link: targetType === 'game' ? `/games/${doc._id}` : `/users/me`,
      game: targetType === 'game' ? doc._id : doc.game,
    });
  return { targetType, targetId: doc._id.toString(), hidden: true, removed: false };
}

export async function restoreContent(targetType, targetId, adminId) {
  const doc = await loadModerationTarget(targetType, targetId);
  if (!doc.hiddenAt) {
    return { targetType, targetId: doc._id.toString(), hidden: false, removed: false };
  }
  doc.hiddenAt = null;
  doc.moderationReason = null;
  await doc.save();
  await record(adminId, 'restore', targetType, doc._id);
  if (targetType === 'review' && doc.status === 'submitted') {
    await Game.updateOne({ _id: doc.game }, { $inc: { reviewCount: 1 } });
  }
  if (targetType === 'reply') {
    await Review.updateOne({ _id: doc.review }, { $inc: { replyCount: 1 } });
  }
  await notify({
    user: ownerId(targetType, doc),
    type: 'content_restored',
    message: `Your ${targetType} is visible again`,
    link: targetType === 'game' ? `/games/${doc._id}` : `/users/me`,
    game: targetType === 'game' ? doc._id : doc.game,
  });
  return { targetType, targetId: doc._id.toString(), hidden: false, removed: false };
}

export async function removeContent(targetType, targetId, adminId) {
  const doc = await loadModerationTarget(targetType, targetId);
  await mongoose.connection.transaction(async (session) => {
    await record(adminId, 'remove', targetType, doc._id, {}, session);
    if (targetType === 'review') {
      await reverseReviewReputation(doc._id, session);
      await Vote.deleteMany({ review: doc._id }).session(session);
      const replies = await Reply.find({ review: doc._id }).select('_id').session(session);
      await Reaction.deleteMany({
        $or: [
          { targetType: 'review', targetId: doc._id },
          { targetType: 'reply', targetId: { $in: replies.map((reply) => reply._id) } },
        ],
      }).session(session);
      await Reply.deleteMany({ review: doc._id }).session(session);
      if (doc.status === 'submitted' && !doc.hiddenAt) {
        await Game.updateOne({ _id: doc.game }, { $inc: { reviewCount: -1 } }, { session });
      }
    }
    if (targetType === 'reply' && !doc.hiddenAt) {
      await Review.updateOne({ _id: doc.review }, { $inc: { replyCount: -1 } }, { session });
    }
    if (targetType === 'game') {
      await Review.deleteMany({ game: doc._id, status: 'in_progress' }).session(session);
    }
    const removedAt = new Date();
    await saveChanges(
      doc,
      { removedAt, hiddenAt: null, ...(targetType === 'game' && { deletedAt: removedAt }) },
      session,
    );
  });
}

async function userStats(userId) {
  const [reviewsWritten, gamesPublished, helpful] = await Promise.all([
    Review.countDocuments({ reviewer: userId, status: 'submitted', removedAt: null }),
    Game.countDocuments({ owner: userId, status: 'published', deletedAt: null, removedAt: null }),
    Review.aggregate([
      { $match: { reviewer: userId, status: 'submitted', removedAt: null } },
      { $group: { _id: null, total: { $sum: '$helpfulCount' } } },
    ]),
  ]);
  return {
    reviewsWritten,
    gamesPublished,
    helpfulVotes: helpful[0]?.total ?? 0,
  };
}

async function toAdminUser(user) {
  const openReportCount = await Report.countDocuments({
    targetType: 'user',
    targetId: user._id,
    status: 'open',
  });
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    status: user.status,
    ...(user.status !== 'active' &&
      user.suspension?.reason && {
        suspension: {
          reason: user.suspension.reason,
          until: user.suspension.until ?? null,
          at: user.suspension.at,
          ...(user.suspension.by && { by: toUserSummary(user.suspension.by) }),
        },
      }),
    reputationPoints: user.reputationPoints,
    stats: await userStats(user._id),
    openReportCount,
    createdAt: user.createdAt,
  };
}

export async function listUsers(query) {
  await liftExpiredSuspensions();
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.role) filter.role = query.role;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ username: pattern }, { displayName: pattern }, { email: pattern }];
    if (/^[a-f\d]{24}$/i.test(query.search)) filter.$or.push({ _id: query.search });
  }
  const [items, total] = await Promise.all([
    Member.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('suspension.by', USER_SUMMARY_FIELDS),
    Member.countDocuments(filter),
  ]);
  return { items: await Promise.all(items.map(toAdminUser)), page, limit, total };
}

async function loadUser(userId) {
  await liftExpiredSuspensions();
  const user = await Member.findById(userId).populate('suspension.by', USER_SUMMARY_FIELDS);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function getUser(userId) {
  return toAdminUser(await loadUser(userId));
}

export async function suspendUser(userId, adminId, { reason, until }) {
  const user = await loadUser(userId);
  if (user.role === 'admin') throw ApiError.forbidden("Admins can't be suspended");
  const status = until == null ? 'banned' : 'suspended';
  const suspension = {
    reason,
    until: until == null ? null : new Date(until),
    at: new Date(),
    by: adminId,
  };
  await setAccess(user._id, { status, suspension });
  user.set({ status, suspension });
  await user.save();
  await record(adminId, user.status === 'banned' ? 'ban' : 'suspend', 'user', user._id, {
    reason,
    ...(until != null && { until: user.suspension.until }),
  });
  return toAdminUser(await loadUser(userId));
}

export async function unsuspendUser(userId, adminId) {
  const user = await loadUser(userId);
  const wasBlocked = user.status !== 'active';
  await setAccess(user._id, { status: 'active', suspension: null });
  user.status = 'active';
  user.suspension = undefined;
  await user.save();
  if (wasBlocked) await record(adminId, 'lift', 'user', user._id);
  return toAdminUser(user);
}

export async function setRole(userId, adminId, role) {
  if (userId === adminId) throw ApiError.forbidden("You can't change your own role");
  const user = await loadUser(userId);
  const changed = user.role !== role;
  await setAccess(user._id, { role });
  user.role = role;
  await user.save();
  if (changed) await record(adminId, 'role_change', 'user', user._id, { role });
  return toAdminUser(user);
}

export async function resolveReport(reportId, adminId, input) {
  const report = await closeReport(reportId, adminId, input);
  await record(adminId, `report_${input.status}`, report.target.type, report.target.id, {
    reason: input.note ?? null,
  });
  return report;
}

export async function listHistory(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = {
    ...(query.targetType && { targetType: query.targetType }),
    ...(query.targetId && { targetId: query.targetId }),
  };
  const [items, total] = await Promise.all([
    ModerationAction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', USER_SUMMARY_FIELDS),
    ModerationAction.countDocuments(filter),
  ]);
  return { items: items.map(toModerationAction), page, limit, total };
}

const CONTENT = {
  game: {
    model: Game,
    author: 'owner',
    base: { status: 'published', $or: [{ deletedAt: null }, { removedAt: { $ne: null } }] },
  },
  review: { model: Review, author: 'reviewer', base: { status: 'submitted' } },
  reply: { model: Reply, author: 'author', base: {} },
};

const CONTENT_STATUS = {
  visible: { hiddenAt: null, removedAt: null },
  hidden: { hiddenAt: { $ne: null }, removedAt: null },
  removed: { removedAt: { $ne: null } },
};

async function contentSearch(search) {
  if (!search) return {};
  const pattern = new RegExp(escapeRegex(search), 'i');
  const [authors, games] = await Promise.all([
    Member.find({ $or: [{ username: pattern }, { displayName: pattern }] }).distinct('_id'),
    Game.find({ title: pattern }).distinct('_id'),
  ]);
  return {
    game: { $or: [{ title: pattern }, { owner: { $in: authors } }] },
    review: { $or: [{ game: { $in: games } }, { reviewer: { $in: authors } }] },
    reply: { $or: [{ body: pattern }, { game: { $in: games } }, { author: { $in: authors } }] },
  };
}

function contentRow(type, doc) {
  const game = type === 'game' ? doc : doc.game;
  const excerpt = { game: null, review: doc.finalVerdict?.changeText, reply: doc.body }[type];
  return {
    type,
    id: doc._id.toString(),
    title: game?.title ?? 'Deleted game',
    excerpt: excerpt ? excerpt.slice(0, 200) : null,
    author: toUserSummary(doc[CONTENT[type].author]),
    status: doc.removedAt ? 'removed' : doc.hiddenAt ? 'hidden' : 'visible',
    reason: doc.moderationReason ?? null,
    link: {
      game: `/games/${doc._id}`,
      review: `/games/${game?._id}/reviews/${doc._id}`,
      reply: `/games/${game?._id}/reviews/${doc.review}`,
    }[type],
    createdAt: doc.createdAt,
  };
}

export async function listContent(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const types = query.type ? [query.type] : Object.keys(CONTENT);
  const search = await contentSearch(query.search);

  // shortcut: loads up to page*limit rows per type and merges them in memory, move to $unionWith if admins page deep
  const results = await Promise.all(
    types.map(async (type) => {
      const { model, author, base } = CONTENT[type];
      const filter = { $and: [base, CONTENT_STATUS[query.status] ?? {}, search[type] ?? {}] };
      let find = model
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(page * limit)
        .populate(author, USER_SUMMARY_FIELDS);
      if (type !== 'game') find = find.populate('game', 'title');
      const [docs, count] = await Promise.all([find, model.countDocuments(filter)]);
      return { count, rows: docs.map((doc) => ({ type, doc })) };
    }),
  );
  const rows = results
    .flatMap((result) => result.rows)
    .sort((a, b) => b.doc.createdAt - a.doc.createdAt || (b.doc.id > a.doc.id ? 1 : -1))
    .slice((page - 1) * limit, page * limit);

  const ids = rows.map((row) => row.doc._id);
  const [reports, actions] = await Promise.all([
    Report.aggregate([
      { $match: { targetId: { $in: ids }, status: 'open' } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
    ]),
    ModerationAction.aggregate([
      { $match: { targetId: { $in: ids } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: '$targetId', action: { $first: '$$ROOT' } } },
    ]),
  ]);
  const lastActions = await ModerationAction.populate(
    actions.map((item) => item.action),
    { path: 'actor', select: USER_SUMMARY_FIELDS },
  );
  const reportCounts = new Map(reports.map((item) => [item._id.toString(), item.count]));
  const lastById = new Map(lastActions.map((item) => [item.targetId.toString(), item]));

  return {
    items: rows.map(({ type, doc }) => {
      const last = lastById.get(doc._id.toString());
      return {
        ...contentRow(type, doc),
        openReportCount: reportCounts.get(doc._id.toString()) ?? 0,
        ...(last && { lastAction: toModerationAction(last) }),
      };
    }),
    page,
    limit,
    total: results.reduce((sum, result) => sum + result.count, 0),
  };
}

const GAME_SORTS = {
  recent: { lastActivityAt: -1 },
  playtests: { playtestCount: -1 },
  reviews: { reviewCount: -1 },
};

export async function listGames(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const match = {
    ...visible,
    ...(query.search && { title: new RegExp(escapeRegex(query.search), 'i') }),
  };
  const [result] = await Game.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Review.collection.name,
        let: { game: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$game', '$$game'] },
              status: { $in: ['in_progress', 'submitted'] },
              removedAt: null,
            },
          },
          { $group: { _id: null, count: { $sum: 1 }, last: { $max: '$updatedAt' } } },
        ],
        as: 'plays',
      },
    },
    {
      $lookup: {
        from: Report.collection.name,
        let: { game: '$_id' },
        pipeline: [
          {
            $match: { $expr: { $eq: ['$targetId', '$$game'] }, targetType: 'game', status: 'open' },
          },
          { $count: 'count' },
        ],
        as: 'reports',
      },
    },
    {
      $project: {
        reviewCount: 1,
        playtestCount: { $ifNull: [{ $first: '$plays.count' }, 0] },
        lastActivityAt: { $ifNull: [{ $first: '$plays.last' }, '$publishedAt'] },
        openReportCount: { $ifNull: [{ $first: '$reports.count' }, 0] },
      },
    },
    { $sort: { ...GAME_SORTS[query.sort ?? 'recent'], _id: -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const [games, featured] = await Promise.all([
    Game.find({ _id: { $in: result.items.map((item) => item._id) } }).populate(
      'owner',
      USER_SUMMARY_FIELDS,
    ),
    Featured.findById('featured'),
  ]);
  const byId = new Map(games.map((game) => [game._id.toString(), game]));
  const featuredIds = new Set((featured?.games ?? []).map((id) => id.toString()));
  return {
    items: result.items.map((item) => ({
      game: toGameCard(byId.get(item._id.toString())),
      playtestCount: item.playtestCount,
      openReportCount: item.openReportCount,
      featured: featuredIds.has(item._id.toString()),
      lastActivityAt: item.lastActivityAt,
    })),
    page,
    limit,
    total: result.total[0]?.count ?? 0,
  };
}

export { listReports, listFeatured, setFeatured, getConfig, toConfig, updateConfig };
