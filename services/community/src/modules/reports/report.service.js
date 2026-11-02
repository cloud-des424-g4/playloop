import { ApiError } from '@playloop/kit';
import { Reply } from '../discussions/discussion.model.js';
import { Game } from '../games/game.model.js';
import { Review } from '../reviews/review.model.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { User } from '../users/user.model.js';
import { Report } from './report.model.js';

async function describeTarget(targetType, targetId) {
  if (targetType === 'game') {
    const game = await Game.findById(targetId).populate('owner', USER_SUMMARY_FIELDS);
    if (!game) throw ApiError.notFound('Game not found');
    return {
      ownerId: game.owner._id.toString(),
      preview: game.title,
      owner: game.owner,
      hidden: Boolean(game.hiddenAt),
      removed: Boolean(game.removedAt || game.deletedAt),
      link: `/games/${game._id}`,
    };
  }
  if (targetType === 'review') {
    const review = await Review.findById(targetId).populate('reviewer', USER_SUMMARY_FIELDS);
    if (!review) throw ApiError.notFound('Review not found');
    return {
      ownerId: review.reviewer._id.toString(),
      preview: (review.finalVerdict?.changeText ?? 'Review').slice(0, 140),
      owner: review.reviewer,
      hidden: Boolean(review.hiddenAt),
      removed: Boolean(review.removedAt),
      link: `/games/${review.game}/reviews/${review._id}`,
    };
  }
  if (targetType === 'reply') {
    const reply = await Reply.findById(targetId).populate('author', USER_SUMMARY_FIELDS);
    if (!reply) throw ApiError.notFound('Reply not found');
    return {
      ownerId: reply.author._id.toString(),
      preview: reply.body.slice(0, 140),
      owner: reply.author,
      hidden: Boolean(reply.hiddenAt),
      removed: Boolean(reply.removedAt),
      link: `/games/${reply.game}/reviews/${reply.review}`,
    };
  }
  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('User not found');
  return {
    ownerId: user._id.toString(),
    preview: user.username,
    owner: user,
    hidden: false,
    removed: user.status === 'banned',
    link: `/users/${user.username}`,
  };
}

export async function createReport(userId, { targetType, targetId, reason, details }) {
  const target = await describeTarget(targetType, targetId);
  if (target.ownerId === userId) throw ApiError.forbidden("You can't report your own content");
  const open = await Report.findOne({ reporter: userId, targetType, targetId, status: 'open' });
  if (open) throw ApiError.conflict('You already reported this');

  const report = await Report.create({
    reporter: userId,
    targetType,
    targetId,
    reason,
    details: details ?? null,
  });
  return {
    id: report._id.toString(),
    targetType,
    targetId: targetId.toString(),
    reason,
    details: report.details,
    status: report.status,
    createdAt: report.createdAt,
  };
}

async function toAdminReport(report) {
  const target = await describeTarget(report.targetType, report.targetId).catch(() => ({
    preview: 'Removed',
    hidden: false,
    removed: true,
    link: '/',
  }));
  const reportCount = await Report.countDocuments({
    targetType: report.targetType,
    targetId: report.targetId,
    status: 'open',
  });
  return {
    id: report._id.toString(),
    reporter: toUserSummary(report.reporter),
    target: {
      type: report.targetType,
      id: report.targetId.toString(),
      preview: target.preview,
      ...(target.owner?._id && { owner: toUserSummary(target.owner) }),
      hidden: target.hidden,
      removed: target.removed,
      link: target.link,
    },
    reason: report.reason,
    details: report.details,
    status: report.status,
    reportCount,
    createdAt: report.createdAt,
    ...(report.resolvedBy && { resolvedBy: toUserSummary(report.resolvedBy) }),
    resolvedAt: report.resolvedAt,
    resolutionNote: report.resolutionNote,
  };
}

export async function listReports(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = {
    ...(query.status && { status: query.status }),
    ...(query.targetType && { targetType: query.targetType }),
  };
  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', USER_SUMMARY_FIELDS)
      .populate('resolvedBy', USER_SUMMARY_FIELDS),
    Report.countDocuments(filter),
  ]);
  return {
    items: await Promise.all(items.map(toAdminReport)),
    page,
    limit,
    total,
  };
}

export async function resolveReport(reportId, adminId, { status, note }) {
  const report = await Report.findById(reportId)
    .populate('reporter', USER_SUMMARY_FIELDS)
    .populate('resolvedBy', USER_SUMMARY_FIELDS);
  if (!report) throw ApiError.notFound('Report not found');
  report.status = status;
  report.resolutionNote = note ?? null;
  report.resolvedAt = new Date();
  report.resolvedBy = adminId;
  await report.save();
  await report.populate('resolvedBy', USER_SUMMARY_FIELDS);
  return toAdminReport(report);
}
