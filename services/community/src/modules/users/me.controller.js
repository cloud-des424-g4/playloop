import * as users from './user.service.js';

export async function getMe(req, res) {
  res.json(await users.getMe(req.user.id));
}

export async function updateMe(req, res) {
  res.json(await users.updateMe(req.user.id, req.body));
}
