import { Router } from 'express';
import { ApiError } from '@playloop/kit';
import { User } from './user.model.js';

export const accessRoutes = Router();

async function findAccount(id) {
  const user = await User.findById(id).select('role status suspension');
  if (!user) throw ApiError.notFound('Account not found');
  return user;
}

accessRoutes.get('/accounts/:id/access', async (req, res) => {
  const { role, status, suspension } = await findAccount(req.params.id);
  res.json({ role, status, suspension });
});

accessRoutes.put('/accounts/:id/access', async (req, res) => {
  const user = await findAccount(req.params.id);
  const { role, status, suspension } = req.body;
  if (role) user.role = role;
  if (status) user.status = status;
  if (suspension !== undefined) user.suspension = suspension ?? undefined;
  await user.save();
  res.status(204).end();
});
