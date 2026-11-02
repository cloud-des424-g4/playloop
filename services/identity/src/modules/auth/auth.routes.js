import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '@playloop/kit';
import * as controller from './auth.controller.js';

const MINUTE = 60 * 1000;
const identifier = (req) => [`ip:${req.ip}`, `id:${String(req.body?.email ?? '').toLowerCase()}`];

export const authRoutes = Router();

authRoutes.post(
  '/register',
  rateLimit({ name: 'register', limit: 5, windowMs: 15 * MINUTE, key: identifier }),
  controller.register,
);
authRoutes.get(
  '/username-available',
  rateLimit({
    name: 'username',
    limit: 30,
    windowMs: MINUTE,
    key: (req) => [`ip:${req.ip}`],
  }),
  controller.checkUsername,
);
authRoutes.post(
  '/login',
  rateLimit({ name: 'login', limit: 10, windowMs: 15 * MINUTE, key: identifier }),
  controller.login,
);
authRoutes.post('/logout', requireAuth, controller.logout);
authRoutes.post(
  '/forgot-password',
  rateLimit({ name: 'forgot-password', limit: 5, windowMs: 60 * MINUTE, key: identifier }),
  controller.forgotPassword,
);
authRoutes.post(
  '/reset-password',
  rateLimit({
    name: 'reset-password',
    limit: 10,
    windowMs: 60 * MINUTE,
    key: (req) => [`ip:${req.ip}`],
  }),
  controller.resetPassword,
);
authRoutes.put(
  '/password',
  requireAuth,
  rateLimit({ name: 'change-password', limit: 10, windowMs: 15 * MINUTE, key: identifier }),
  controller.changePassword,
);
