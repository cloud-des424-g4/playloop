import mongoose from 'mongoose';
import { ApiError } from '@playloop/kit';
import { notify } from '../outbox/outbox.service.js';
import { Game } from '../games/game.model.js';
import { Review } from '../reviews/review.model.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { Reaction, Reply } from './discussion.model.js';

const EMOJIS = ['thumbs_up', 'heart', 'laugh', 'wow', 'fire', 'clap'];

export async function reactionSummaries(targetType, targetIds, userId) {
  const ids = [].concat(targetIds);
  const grouped = new Map(ids.map((id) => [id.toString(), []]));
  if (!ids.length) return grouped;
  const rows = await Reaction.find({ targetType, targetId: { $in: ids } });
  const buckets = new Map();
  for (const row of rows) {
    const key = `${row.targetId}:${row.emoji}`;
    const bucket = buckets.get(key) ?? {
      targetId: row.targetId.toString(),
      emoji: row.emoji,
      count: 0,
      reactedByMe: false,
    };
    bucket.count += 1;
    if (userId && row.user.equals(userId)) bucket.reactedByMe = true;
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) {
    grouped.get(bucket.targetId).push({
      emoji: bucket.emoji,
      count: bucket.count,
      reactedByMe: bucket.reactedByMe,
    });
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => EMOJIS.indexOf(a.emoji) - EMOJIS.indexOf(b.emoji));
  }
  return grouped;
}

async function visibleReview(reviewId) {
  const review = await Review.findById(reviewId).populate({
    path: 'game',
    select: 'title owner deletedAt hiddenAt',
  });
  if (!review || review.status !== 'submitted' || review.removedAt || review.hiddenAt) {
    throw ApiError.notFound('Review not found');
  }
  if (review.game?.deletedAt || review.game?.hiddenAt) throw ApiError.notFound('Review not found');
  return review;
}

async function toReply(reply, review, userId, reactions) {
  const authorId = reply.author._id.toString();
  return {
    id: reply._id.toString(),
    reviewId: reply.review.toString(),
    author: toUserSummary(reply.author),
    isGameOwner: review.game.owner.equals(authorId) || review.game.owner._id?.equals(authorId),
    isReviewAuthor: review.reviewer.equals(authorId) || review.reviewer._id?.equals(authorId),
    body: reply.body,
    edited: reply.edited,
    reactions:
      reactions ??
      (await reactionSummaries('reply', [reply._id], userId)).get(reply._id.toString()),
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  };
}

export async function listReplies(reviewId, userId, query) {
  const review = await visibleReview(reviewId);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = { review: review._id, removedAt: null, hiddenAt: null };
  const [items, total] = await Promise.all([
    Reply.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', USER_SUMMARY_FIELDS),
    Reply.countDocuments(filter),
  ]);
  const reactions = await reactionSummaries(
    'reply',
    items.map((item) => item._id),
    userId,
  );
  return {
    items: await Promise.all(
      items.map((item) => toReply(item, review, userId, reactions.get(item._id.toString()) ?? [])),
    ),
    page,
    limit,
    total,
  };
}

export async function createReply(reviewId, userId, { body }) {
  const review = await visibleReview(reviewId);
  const game = await Game.findById(review.game._id).select('owner title');
  let reply;
  await mongoose.connection.transaction(async (session) => {
    [reply] = await Reply.create([{ review: review._id, game: game._id, author: userId, body }], {
      session,
    });
    await Review.updateOne({ _id: review._id }, { $inc: { replyCount: 1 } }, { session });
  });
  await reply.populate('author', USER_SUMMARY_FIELDS);

  const link = `/games/${game._id}/reviews/${review._id}`;
  const recipients = new Set([review.reviewer.toString(), game.owner.toString()]);
  recipients.delete(userId);
  for (const recipient of recipients) {
    await notify({
      user: recipient,
      type: 'reply_received',
      message: `${reply.author.displayName} replied to ${recipient === review.reviewer.toString() ? 'your' : 'a'} review of ${game.title}`,
      link,
      actor: userId,
      game: game._id,
      reviewId: review._id,
    });
  }
  return toReply(reply, { ...review.toObject(), game, reviewer: review.reviewer }, userId, []);
}

async function ownedReply(replyId, userId) {
  const reply = await Reply.findById(replyId).populate('author', USER_SUMMARY_FIELDS);
  if (!reply || reply.removedAt) throw ApiError.notFound('Reply not found');
  if (!reply.author._id.equals(userId)) throw ApiError.forbidden();
  return reply;
}

export async function updateReply(replyId, userId, { body }) {
  const reply = await ownedReply(replyId, userId);
  const review = await visibleReview(reply.review);
  reply.body = body;
  reply.edited = true;
  await reply.save();
  return toReply(reply, review, userId);
}

export async function deleteReply(replyId, userId) {
  const reply = await ownedReply(replyId, userId);
  await Reaction.deleteMany({ targetType: 'reply', targetId: reply._id });
  await reply.deleteOne();
  await Review.updateOne({ _id: reply.review }, { $inc: { replyCount: -1 } });
}

async function targetExists(targetType, targetId) {
  if (targetType === 'review') {
    const review = await Review.findOne({
      _id: targetId,
      status: 'submitted',
      removedAt: null,
      hiddenAt: null,
    });
    if (!review) throw ApiError.notFound('Review not found');
    return;
  }
  const reply = await Reply.findOne({ _id: targetId, removedAt: null, hiddenAt: null });
  if (!reply) throw ApiError.notFound('Reply not found');
}

export async function addReaction(targetType, targetId, emoji, userId) {
  if (!EMOJIS.includes(emoji)) throw ApiError.notFound('Not found');
  await targetExists(targetType, targetId);
  await Reaction.updateOne(
    { user: userId, targetType, targetId, emoji },
    { $setOnInsert: { user: userId, targetType, targetId, emoji } },
    { upsert: true },
  );
  return reactionResult(targetType, targetId, userId);
}

export async function removeReaction(targetType, targetId, emoji, userId) {
  if (!EMOJIS.includes(emoji)) throw ApiError.notFound('Not found');
  await targetExists(targetType, targetId);
  await Reaction.deleteOne({ user: userId, targetType, targetId, emoji });
  return reactionResult(targetType, targetId, userId);
}

async function reactionResult(targetType, targetId, userId) {
  const reactions = await reactionSummaries(targetType, [targetId], userId);
  return {
    targetType,
    targetId: targetId.toString(),
    reactions: reactions.get(targetId.toString()) ?? [],
  };
}
