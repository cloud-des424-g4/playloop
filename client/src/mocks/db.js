import { levelFor } from '@playloop/shared';

// In-memory stand-in for the users collection behind docs/api/paths/auth.yaml. State lives for the
// page lifetime only: reloading the browser (or calling resetMockDb in tests) starts fresh.

// Usernames the real API answers `reserved` for. The list is a guess; the spec only names the reason.
const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'root', 'support', 'playloop']);

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const MAX_LOGIN_FAILURES = 5;

// Seed accounts for trying the forms by hand.
export const SEED_USERS = [
  { username: 'enolaholmes', email: 'enola@example.com', password: 'storm-chaser-42' },
  {
    username: 'suspended_sam',
    email: 'suspended@example.com',
    password: 'suspended-pass1',
    status: 'suspended',
    statusReason: 'Repeated spam reports',
  },
  {
    username: 'banned_bea',
    email: 'banned@example.com',
    password: 'banned-pass-1',
    status: 'banned',
    statusReason: 'Harassment of other users',
  },
];

let users = [];
let sessionUserId = null;
let loginFailures = new Map();
let counter = 0;

// 24-character hex id, like the API's ObjectId.
function objectId() {
  counter += 1;
  const seconds = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  return seconds + counter.toString(16).padStart(16, '0');
}

function createUser({ username, email, password, status = 'active', statusReason = null }) {
  const user = {
    id: objectId(),
    username,
    email: email.toLowerCase(),
    password,
    role: 'user',
    status,
    statusReason,
    joinedAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

export function resetMockDb() {
  users = [];
  sessionUserId = null;
  loginFailures = new Map();
  counter = 0;
  SEED_USERS.forEach(createUser);
}

resetMockDb();

// The `Me` schema from docs/api/schemas/user.yaml.
export function toMe(user) {
  const { level, title, minPoints, nextLevelMinPoints } = levelFor(0);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    displayName: user.username,
    pronouns: null,
    bio: '',
    avatarUrl: null,
    favoriteGenres: [],
    platforms: [],
    links: [],
    joinedAt: user.joinedAt,
    reputation: { points: 0, level, title, levelMinPoints: minPoints, nextLevelMinPoints },
    badges: [],
    stats: { reviewsWritten: 0, gamesPublished: 0, helpfulVotes: 0 },
  };
}

// Mirrors the `UsernameAvailability` schema: reason is only set when the name is not available.
export function usernameAvailability(username) {
  if (!USERNAME_PATTERN.test(username)) return { available: false, reason: 'invalid' };
  if (RESERVED_USERNAMES.has(username.toLowerCase()))
    return { available: false, reason: 'reserved' };
  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    return { available: false, reason: 'taken' };
  }
  return { available: true };
}

export function emailTaken(email) {
  return users.some((user) => user.email === email.toLowerCase());
}

export function addUser(input) {
  return createUser(input);
}

export function findUserByEmail(email) {
  return users.find((user) => user.email === email.toLowerCase()) ?? null;
}

export function findUserById(id) {
  return users.find((user) => user.id === id) ?? null;
}

export function setSession(userId) {
  sessionUserId = userId;
}

export function currentUser() {
  return sessionUserId ? findUserById(sessionUserId) : null;
}

// Per-email login failure counter standing in for the API's rate limit (login is limited per IP and
// per email). After MAX_LOGIN_FAILURES wrong attempts the email gets 429 until the db is reset.
export function isLoginRateLimited(email) {
  return (loginFailures.get(email.toLowerCase()) ?? 0) >= MAX_LOGIN_FAILURES;
}

export function recordLoginFailure(email) {
  const key = email.toLowerCase();
  loginFailures.set(key, (loginFailures.get(key) ?? 0) + 1);
}

export function clearLoginFailures(email) {
  loginFailures.delete(email.toLowerCase());
}
