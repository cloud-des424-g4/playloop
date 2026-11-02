import { Router } from 'express';
import { ApiError } from '@playloop/kit';
import { checkUploadTarget } from '../games/upload-target.service.js';
import { User } from '../users/user.model.js';
import { refs } from './refs.service.js';

export const serviceRoutes = Router();

serviceRoutes.post('/refs', async (req, res) => {
  res.json(await refs(req.body));
});

serviceRoutes.post('/upload-targets/check', async (req, res) => {
  await checkUploadTarget(req.body);
  res.status(204).end();
});

serviceRoutes.get('/accounts/:id/access', async (req, res) => {
  const user = await User.findById(req.params.id).select('role status suspension');
  if (!user) throw ApiError.notFound('Account not found');
  res.json({ role: user.role, status: user.status, suspension: user.suspension });
});
