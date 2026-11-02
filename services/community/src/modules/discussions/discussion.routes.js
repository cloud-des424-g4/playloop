import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '@playloop/kit';
import * as controller from './discussion.controller.js';

const MINUTE = 60 * 1000;

export const replyRoutes = Router();

replyRoutes.patch('/:replyId', requireAuth, controller.updateReply);
replyRoutes.delete('/:replyId', requireAuth, controller.deleteReply);

export const reactionRoutes = Router();

reactionRoutes.put(
  '/:targetType/:targetId/:emoji',
  requireAuth,
  rateLimit({
    name: 'reaction',
    limit: 60,
    windowMs: 10 * MINUTE,
    key: (req) => [`user:${req.user.id}`],
  }),
  controller.addReaction,
);
reactionRoutes.delete('/:targetType/:targetId/:emoji', requireAuth, controller.removeReaction);
