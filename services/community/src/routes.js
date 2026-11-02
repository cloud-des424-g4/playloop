import { Router } from 'express';
import { optionalAuth } from './middleware/auth.js';
import { rateLimit } from '@playloop/kit';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { replyRoutes, reactionRoutes } from './modules/discussions/discussion.routes.js';
import { featured, recommendations } from './modules/games/discovery.controller.js';
import { gameRoutes, myGameRoutes } from './modules/games/game.routes.js';
import { internalRoutes } from './modules/internal/internal.routes.js';
import { leaderboard } from './modules/meta/meta.controller.js';
import { metaRoutes } from './modules/meta/meta.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';
import {
  gameFeedbackRoutes,
  gameReviewRoutes,
  myReviewRoutes,
  reviewRoutes,
} from './modules/reviews/review.routes.js';
import { rouletteRoutes } from './modules/roulette/roulette.routes.js';
import { meRoutes } from './modules/users/me.routes.js';
import { userRoutes } from './modules/users/user.routes.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/games/:gameId/reviews', gameReviewRoutes);
routes.use('/games/:gameId/feedback', gameFeedbackRoutes);
routes.use('/games', gameRoutes);
routes.get('/recommendations', optionalAuth, recommendations);
routes.get(
  '/featured',
  rateLimit({ name: 'featured', limit: 120, windowMs: 60_000, key: (req) => [`ip:${req.ip}`] }),
  featured,
);
routes.use('/reviews', reviewRoutes);
routes.use('/replies', replyRoutes);
routes.use('/reactions', reactionRoutes);
routes.use('/roulette', rouletteRoutes);
routes.use('/reports', reportRoutes);
routes.use('/me/games', myGameRoutes);
routes.use('/me/reviews', myReviewRoutes);
routes.use('/me', meRoutes);
routes.use('/users', userRoutes);
routes.use('/meta', metaRoutes);
routes.get('/leaderboard', leaderboard);
routes.use('/admin', adminRoutes);
routes.use('/internal', internalRoutes);
