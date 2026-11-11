import { delay, http, HttpResponse } from 'msw';
import {
  addUser,
  clearLoginFailures,
  currentUser,
  emailTaken,
  findUserByEmail,
  isLoginRateLimited,
  recordLoginFailure,
  setSession,
  toMe,
  usernameAvailability,
} from './db.js';

// Request/response shapes follow docs/api (paths/auth.yaml, paths/me.yaml, schemas/Error.yaml).
// The `*/api` prefix matches the /api base URL on any origin, including the test server.
const API = '*/api';

// Error schema: { code, message, details? }.
function apiError(status, code, message, details) {
  return HttpResponse.json({ code, message, ...(details && { details }) }, { status });
}

function validationError(details) {
  return apiError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details);
}

// ajv-style messages, as in docs/api/responses/errors.yaml.
const problems = {
  required: (field) => ({ path: '/body', message: `must have required property '${field}'` }),
  pattern: (field, pattern) => ({
    path: `/body/${field}`,
    message: `must match pattern "${pattern}"`,
  }),
  format: (field, format) => ({ path: `/body/${field}`, message: `must match format "${format}"` }),
  min: (field, n) => ({
    path: `/body/${field}`,
    message: `must NOT have fewer than ${n} characters`,
  }),
  max: (field, n) => ({
    path: `/body/${field}`,
    message: `must NOT have more than ${n} characters`,
  }),
  type: (field, type) => ({ path: `/body/${field}`, message: `must be ${type}` }),
  extra: () => ({ path: '/body', message: 'must NOT have additional properties' }),
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkEmail(body, details) {
  if (typeof body.email !== 'string') return details.push(problems.type('email', 'string'));
  if (body.email.length > 254) details.push(problems.max('email', 254));
  else if (!EMAIL_PATTERN.test(body.email)) details.push(problems.format('email', 'email'));
}

// Walks the body once against a field list, so unknown and missing fields are reported like the API.
function validateBody(body, required, check) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return [{ path: '/body', message: 'must be object' }];
  }
  const details = [];
  if (Object.keys(body).some((key) => !required.includes(key))) details.push(problems.extra());
  for (const field of required) if (!(field in body)) details.push(problems.required(field));
  if (!details.some((problem) => problem.message.startsWith('must have required'))) {
    check(body, details);
  }
  return details;
}

function checkRegister(body, details) {
  if (typeof body.username !== 'string') details.push(problems.type('username', 'string'));
  else if (!/^[A-Za-z0-9_]{3,20}$/.test(body.username)) {
    details.push(problems.pattern('username', '^[A-Za-z0-9_]{3,20}$'));
  }
  checkEmail(body, details);
  if (typeof body.password !== 'string') details.push(problems.type('password', 'string'));
  else if (body.password.length < 8) details.push(problems.min('password', 8));
  else if (body.password.length > 72) details.push(problems.max('password', 72));
  if (body.acceptTerms !== true) {
    details.push({
      path: '/body/acceptTerms',
      message: 'must be equal to one of the allowed values',
    });
  }
}

function checkLogin(body, details) {
  checkEmail(body, details);
  if (typeof body.password !== 'string') details.push(problems.type('password', 'string'));
  else if (body.password.length < 1) details.push(problems.min('password', 1));
  else if (body.password.length > 72) details.push(problems.max('password', 72));
}

async function readBody(request) {
  return request.json().catch(() => null);
}

export const handlers = [
  // GET /auth/username-available?username= (1-40 characters)
  http.get(`${API}/auth/username-available`, async ({ request }) => {
    await delay();
    const username = new URL(request.url).searchParams.get('username');
    if (username === null || username.length < 1 || username.length > 40) {
      return validationError([
        username === null
          ? { path: '/query', message: "must have required property 'username'" }
          : username.length < 1
            ? problems.min('username', 1)
            : problems.max('username', 40),
      ]);
    }
    return HttpResponse.json({ username, ...usernameAvailability(username) });
  }),

  // POST /auth/register -> 201 Me (400, 409, 429)
  http.post(`${API}/auth/register`, async ({ request }) => {
    await delay();
    const body = await readBody(request);
    const details = validateBody(
      body,
      ['username', 'email', 'password', 'acceptTerms'],
      checkRegister,
    );
    if (details.length) return validationError(details);

    const { available } = usernameAvailability(body.username);
    if (!available) return apiError(409, 'CONFLICT', 'username is already taken');
    if (emailTaken(body.email)) return apiError(409, 'CONFLICT', 'email is already registered');

    const user = addUser(body);
    setSession(user.id);
    return HttpResponse.json(toMe(user), { status: 201 });
  }),

  // POST /auth/login -> 200 Me (400, 401, 403, 429). Wrong email and wrong password look the same.
  http.post(`${API}/auth/login`, async ({ request }) => {
    await delay();
    const body = await readBody(request);
    const details = validateBody(body, ['email', 'password'], checkLogin);
    if (details.length) return validationError(details);

    if (isLoginRateLimited(body.email)) {
      return apiError(429, 'RATE_LIMITED', 'Too many requests, please try again later');
    }
    const user = findUserByEmail(body.email);
    if (!user || user.password !== body.password) {
      recordLoginFailure(body.email);
      return apiError(401, 'UNAUTHORIZED', 'Email or password is incorrect');
    }
    if (user.status !== 'active') {
      return apiError(403, 'FORBIDDEN', `Your account is ${user.status}: ${user.statusReason}`);
    }
    clearLoginFailures(body.email);
    setSession(user.id);
    return HttpResponse.json(toMe(user));
  }),

  // POST /auth/logout -> 204 (401 when not logged in)
  http.post(`${API}/auth/logout`, async () => {
    await delay();
    if (!currentUser()) return apiError(401, 'UNAUTHORIZED', 'Please log in to continue');
    setSession(null);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /me -> Me (401 when logged out)
  http.get(`${API}/me`, async () => {
    await delay();
    const user = currentUser();
    if (!user) return apiError(401, 'UNAUTHORIZED', 'Please log in to continue');
    return HttpResponse.json(toMe(user));
  }),
];
