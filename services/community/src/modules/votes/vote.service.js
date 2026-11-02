import mongoose from 'mongoose';
import { ApiError } from '@playloop/kit';
import {
  adjustReputation,
  awardAchievements,
  notifyProgress,
  votePoints,
} from '../reputation/reputation.service.js';
import { Review } from '../reviews/review.model.js';
import { Vote } from './vote.model.js';

async function visibleReview(reviewId) {
  const review = await Review.findById(reviewId).populate('reviewer', 'displayName');
  if (!review || review.removedAt || review.hiddenAt || review.status !== 'submitted') {
    throw ApiError.notFound('Review not found');
  }
  return review;
}

function countsOf(review, myVote) {
  return {
    reviewId: review._id.toString(),
    helpfulCount: review.helpfulCount,
    notHelpfulCount: review.notHelpfulCount,
    myVote,
  };
}

async function applyVote(review, userId, nextValue) {
  const link = `/games/${review.game}/reviews/${review._id}`;
  let progress = null;
  await mongoose.connection.transaction(async (session) => {
    const existing = await Vote.findOne({ user: userId, review: review._id }).session(session);
    const previous = existing?.value ?? null;
    if (previous === nextValue) return;

    const desired = nextValue == null ? 0 : votePoints(nextValue);
    const alreadyApplied = existing?.appliedPoints ?? 0;
    progress = await adjustReputation(
      review.reviewer._id,
      desired - alreadyApplied,
      {
        review: review._id,
        kind: nextValue === 1 ? 'helpful' : nextValue === -1 ? 'not_helpful' : 'vote_removed',
      },
      session,
    );
    const appliedPoints = alreadyApplied + (progress?.applied ?? 0);
    if (nextValue == null) await existing.deleteOne({ session });
    else if (existing) {
      existing.value = nextValue;
      existing.appliedPoints = appliedPoints;
      await existing.save({ session });
    } else {
      await Vote.create([{ user: userId, review: review._id, value: nextValue, appliedPoints }], {
        session,
      });
    }

    const [helpfulCount, notHelpfulCount] = await Promise.all([
      Vote.countDocuments({ review: review._id, value: 1 }).session(session),
      Vote.countDocuments({ review: review._id, value: -1 }).session(session),
    ]);
    review.helpfulCount = helpfulCount;
    review.notHelpfulCount = notHelpfulCount;
    await review.save({ session });
    const badges = await awardAchievements(review.reviewer._id, session);
    await notifyProgress(
      review.reviewer._id,
      { before: progress?.before, after: progress?.after, badges },
      link,
      session,
    );
  });
  return countsOf(review, nextValue);
}

export async function setVote(reviewId, userId, value) {
  const review = await visibleReview(reviewId);
  if (review.reviewer._id.equals(userId))
    throw ApiError.forbidden("You can't vote on your own review");
  return applyVote(review, userId, value);
}

export async function removeVote(reviewId, userId) {
  const review = await visibleReview(reviewId);
  const existing = await Vote.findOne({ user: userId, review: review._id });
  if (!existing) return countsOf(review, null);
  return applyVote(review, userId, null);
}

export async function votesByReview(reviewIds, userId) {
  if (!userId || !reviewIds.length) return new Map();
  const votes = await Vote.find({ review: { $in: reviewIds }, user: userId });
  return new Map(votes.map((vote) => [vote.review.toString(), vote.value]));
}
