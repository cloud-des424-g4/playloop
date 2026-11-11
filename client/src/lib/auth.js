import { api, ApiError } from './api.js';

// Auth endpoints from docs/api/paths/auth.yaml. The session itself is the httpOnly
// playloop_token cookie, so none of these return or store a token.

// A 2xx whose body is not a user (an HTML page from a misconfigured rewrite, an empty body) must
// not count as a successful login. It is reported like a gateway failure.
function expectMe(user) {
  if (!user || typeof user.id !== 'string') throw new ApiError(502, null);
  return user;
}

// GET /auth/username-available -> { username, available, reason? } (reason: taken | invalid | reserved)
export function checkUsername(username, options) {
  return api.get(`/auth/username-available?username=${encodeURIComponent(username)}`, options);
}

// POST /auth/register -> 201 Me. `acceptTerms` must be the literal `true`.
export async function register({ username, email, password }) {
  return expectMe(
    await api.post('/auth/register', { username, email, password, acceptTerms: true }),
  );
}

// POST /auth/login -> 200 Me
export async function login({ email, password }) {
  return expectMe(await api.post('/auth/login', { email, password }));
}

// POST /auth/logout -> 204
export function logout() {
  return api.post('/auth/logout');
}

// GET /me -> Me, or 401 when logged out. Call it on app start.
export function getMe(options) {
  return api.get('/me', options);
}
