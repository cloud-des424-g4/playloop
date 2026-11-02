import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '@playloop/kit';
import * as controller from './report.controller.js';

const MINUTE = 60 * 1000;

export const reportRoutes = Router();

reportRoutes.post(
  '/',
  requireAuth,
  rateLimit({
    name: 'report',
    limit: 20,
    windowMs: 60 * MINUTE,
    key: (req) => [`user:${req.user.id}`],
  }),
  controller.createReport,
);
