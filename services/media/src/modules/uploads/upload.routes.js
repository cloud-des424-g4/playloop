import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '@playloop/kit';
import * as controller from './upload.controller.js';

const MINUTE = 60 * 1000;

export const uploadRoutes = Router();

uploadRoutes.post(
  '/',
  requireAuth,
  rateLimit({
    name: 'upload',
    limit: 60,
    windowMs: 60 * MINUTE,
    key: (req) => [`user:${req.user.id}`],
  }),
  controller.createUpload,
);
uploadRoutes.post('/:uploadId/complete', requireAuth, controller.completeUpload);
