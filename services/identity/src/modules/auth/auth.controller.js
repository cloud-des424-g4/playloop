import { clearSessionCookie, setSessionCookie } from '@playloop/kit';
import { memberFor } from '../accounts/community.client.js';
import * as auth from './auth.service.js';

export async function register(req, res) {
  const user = await auth.register(req.body);
  let me;
  try {
    me = await memberFor(user);
  } catch (err) {
    await user.deleteOne();
    throw err;
  }
  setSessionCookie(res, user);
  res.status(201).json(me);
}

export async function checkUsername(req, res) {
  res.json(await auth.checkUsername(req.query.username));
}

export async function login(req, res) {
  const user = await auth.login(req.body);
  const me = await memberFor(user);
  setSessionCookie(res, user);
  res.json(me);
}

export async function logout(_req, res) {
  clearSessionCookie(res);
  res.status(204).end();
}

export async function forgotPassword(req, res) {
  await auth.requestPasswordReset(req.body.email);
  res.status(202).end();
}

export async function resetPassword(req, res) {
  await auth.resetPassword(req.body);
  res.status(204).end();
}

export async function changePassword(req, res) {
  await auth.changePassword(req.user.id, req.body);
  res.status(204).end();
}
