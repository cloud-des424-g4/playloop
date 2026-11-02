import { Router } from 'express';
import { ApiError } from '@playloop/kit';
import { User } from '../users/user.model.js';
import { refs } from './refs.service.js';

export const serviceRoutes = Router();

serviceRoutes.post('/refs', async (req, res) => {
  res.json(await refs(req.body));
});

serviceRoutes.get('/accounts/:id/access', async (req, res) => {
  const user = await User.findById(req.params.id).select('role status suspension');
  if (!user) throw ApiError.notFound('Account not found');
  res.json({ role: user.role, status: user.status, suspension: user.suspension });
});
