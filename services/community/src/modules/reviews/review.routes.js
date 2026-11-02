import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '@playloop/kit';
import * as discussions from '../discussions/discussion.controller.js';
import * as votes from '../votes/vote.service.js';
import * as controller from './review.controller.js';

const MINUTE = 60 * 1000;

export const gameReviewRoutes = Router({ mergeParams: true });

gameReviewRoutes.get('/', optionalAuth, controller.listGameReviews);
gameReviewRoutes.post('/', requireAuth, controller.startReview);

export const gameFeedbackRoutes = Router({ mergeParams: true });

gameFeedbackRoutes.get('/', requireAuth, controller.getFeedbackInbox);

export const reviewRoutes = Router();

reviewRoutes.get('/:reviewId', optionalAuth, controller.getReview);
reviewRoutes.delete('/:reviewId', requireAuth, controller.deleteReview);
reviewRoutes.put('/:reviewId/first-impression', requireAuth, controller.saveFirstImpression);
reviewRoutes.post('/:reviewId/missions/:missionId/accept', requireAuth, controller.acceptMission);
reviewRoutes.post('/:reviewId/cards', requireAuth, controller.addCard);
reviewRoutes.patch('/:reviewId/cards/:cardId', requireAuth, controller.updateCard);
reviewRoutes.delete('/:reviewId/cards/:cardId', requireAuth, controller.deleteCard);
reviewRoutes.put('/:reviewId/playtest', requireAuth, controller.savePlaytest);
reviewRoutes.put('/:reviewId/developer-answers', requireAuth, controller.saveDeveloperAnswers);
reviewRoutes.put('/:reviewId/final-verdict', requireAuth, controller.saveFinalVerdict);
reviewRoutes.post('/:reviewId/submit', requireAuth, controller.submitReview);
reviewRoutes.put('/:reviewId/feedback-status', requireAuth, controller.setFeedbackStatus);
reviewRoutes.put(
  '/:reviewId/vote',
  requireAuth,
  rateLimit({
    name: 'vote',
    limit: 60,
    windowMs: 10 * MINUTE,
    key: (req) => [`user:${req.user.id}`],
  }),
  async (req, res) => {
    res.json(await votes.setVote(req.params.reviewId, req.user.id, req.body.value));
  },
);
reviewRoutes.delete('/:reviewId/vote', requireAuth, async (req, res) => {
  res.json(await votes.removeVote(req.params.reviewId, req.user.id));
});
reviewRoutes.get('/:reviewId/replies', optionalAuth, discussions.listReplies);
reviewRoutes.post(
  '/:reviewId/replies',
  requireAuth,
  rateLimit({
    name: 'reply',
    limit: 30,
    windowMs: 10 * MINUTE,
    key: (req) => [`user:${req.user.id}`],
  }),
  discussions.createReply,
);

export const myReviewRoutes = Router();

myReviewRoutes.get('/', requireAuth, controller.listMyReviews);
