import { ApiError } from '@playloop/kit';
import { Review } from '../reviews/review.model.js';
import { Game } from './game.model.js';

async function checkGame(gameId, userId) {
  const game = await Game.findOne({ _id: gameId, deletedAt: null, removedAt: null });
  if (!game) throw ApiError.notFound('Game not found');
  if (!game.owner.equals(userId)) throw ApiError.forbidden();
}

async function checkReview(reviewId, userId) {
  const review = await Review.findById(reviewId);
  if (!review || review.removedAt) throw ApiError.notFound('Review not found');
  if (!review.reviewer.equals(userId)) throw ApiError.forbidden();
  if (review.status !== 'in_progress') {
    throw ApiError.conflict('This review is already submitted');
  }
}

export async function checkUploadTarget({ userId, gameId, reviewId }) {
  if (gameId) await checkGame(gameId, userId);
  if (reviewId) await checkReview(reviewId, userId);
}
