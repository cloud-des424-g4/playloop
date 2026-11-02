import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '@playloop/kit';
import * as controller from './roulette.controller.js';

const MINUTE = 60 * 1000;
const limit = rateLimit({
  name: 'roulette',
  limit: 30,
  windowMs: 10 * MINUTE,
  key: (req) => [`user:${req.user.id}`],
});

export const rouletteRoutes = Router();

rouletteRoutes.post('/spin', requireAuth, limit, controller.spin);
rouletteRoutes.post('/accept', requireAuth, controller.accept);
