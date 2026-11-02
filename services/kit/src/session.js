import jwt from 'jsonwebtoken';
import { ApiError } from './ApiError.js';
import { env } from './env.js';

export const SESSION_COOKIE = 'playloop_token';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/',
});

export function signSessionToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function setSessionCookie(res, user) {
  res.cookie(SESSION_COOKIE, signSessionToken(user), { ...cookieOptions(), maxAge: WEEK_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function accountBlockMessage(account) {
  if (account.status === 'banned') return 'Your account has been banned';
  if (account.status !== 'suspended') return null;
  if (!account.suspension?.until) return 'Your account is suspended';
  // Services outside Identity receive this date as a JSON string
  const until = new Date(account.suspension.until);
  if (until > new Date()) {
    return `Your account is suspended until ${until.toISOString().slice(0, 10)}`;
  }
  return null;
}

function sessionUserId(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }).sub;
  } catch {
    return null;
  }
}

export function createAuth(loadAccount) {
  async function loadUser(req) {
    const id = sessionUserId(req);
    if (!id) return null;
    const account = await loadAccount(id);
    return account && { id, account };
  }

  async function requireAuth(req, _res, next) {
    const user = await loadUser(req);
    if (!user) throw ApiError.unauthorized();
    const reason = accountBlockMessage(user.account);
    if (reason) throw ApiError.forbidden(reason);
    req.user = { id: user.id, role: user.account.role };
    next();
  }

  async function optionalAuth(req, _res, next) {
    const user = await loadUser(req);
    req.user =
      user && !accountBlockMessage(user.account) ? { id: user.id, role: user.account.role } : null;
    next();
  }

  async function requireAdmin(req, res, next) {
    await requireAuth(req, res, () => {});
    if (req.user.role !== 'admin') throw ApiError.forbidden();
    next();
  }

  return { requireAuth, optionalAuth, requireAdmin };
}
