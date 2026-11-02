import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import http from 'node:http';

const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:4000';
const { SEED_PASSWORD, SMOKE_REMOTE } = process.env;
assert(SEED_PASSWORD, 'Set SEED_PASSWORD');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const completeFields = {
  pitch: 'Survive a storm-cursed island.',
  genres: ['survival', 'adventure'],
  platforms: ['web'],
  buildStage: 'alpha',
  engine: 'godot',
  coreGameplay: ['Explore the island', 'Hide from lightning'],
  playable: ['Two districts'],
  delivery: { method: 'web', webUrl: 'https://example.itch.io/tempest' },
};

const missions = [
  { id: 'm1', title: 'Find the crash site radio', minutes: 5 },
  { id: 'm2', title: 'Reach the research facility', minutes: 10 },
];

const firstImpression = [
  { questionId: 'impression', text: 'Looks like a survival game.' },
  { questionId: 'difficulty', optionId: 'challenging' },
  { questionId: 'strength', optionId: 'visuals' },
  { questionId: 'audience', optionId: 'experienced' },
  { questionId: 'excitement', number: 4 },
];

const verdict = {
  comparison: 'different',
  changeText: 'Slower than I expected.',
  actualDifficulty: 'moderate',
  enjoyment: 4,
  improveCategory: 'visuals',
  improveText: 'Mark the facility entrances.',
};

const avatarUpload = {
  purpose: 'avatar',
  fileName: 'me.png',
  contentType: 'image/png',
  size: PNG.length,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(method, path, { cookie, body } = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

async function ok(method, path, options) {
  const res = await send(method, path, options);
  assert(res.status < 300, `${method} ${path} returned ${res.status}: ${JSON.stringify(res.body)}`);
  return res;
}

const sessionCookie = (res) => res.headers.getSetCookie()[0].split(';')[0];

async function register(name) {
  const res = await ok('POST', '/api/auth/register', {
    body: {
      username: name,
      email: `${name}@example.com`,
      password: 'Smoke-account-password-1',
      acceptTerms: true,
    },
  });
  return { id: res.body.id, cookie: sessionCookie(res) };
}

async function uploadCover(gameId, cookie) {
  const { body: target } = await ok('POST', '/api/uploads', {
    cookie,
    body: {
      purpose: 'game_media',
      fileName: 'cover.png',
      contentType: 'image/png',
      size: PNG.length,
      gameId,
    },
  });
  const stored = await fetch(target.url, { method: 'PUT', headers: target.headers, body: PNG });
  assert(stored.ok, `Storage returned ${stored.status}`);
  await ok('POST', `/api/uploads/${target.id}/complete`, { cookie, body: {} });
  return target.id;
}

async function publishGame(cookie) {
  const { body: game } = await ok('POST', '/api/games', { cookie, body: { title: 'Tempest' } });
  const path = `/api/games/${game.id}`;
  await ok('PATCH', path, { cookie, body: completeFields });
  await ok('PATCH', `${path}/form`, {
    cookie,
    body: { playtest: { missions, knownIssues: [], questions: [] } },
  });
  await ok('PATCH', path, { cookie, body: { mediaIds: [await uploadCover(game.id, cookie)] } });
  await ok('POST', `${path}/publish`, { cookie });
  return game.id;
}

async function submitReview(gameId, cookie) {
  const { body: review } = await ok('POST', `/api/games/${gameId}/reviews`, { cookie });
  const path = `/api/reviews/${review.id}`;
  await ok('PUT', `${path}/first-impression`, {
    cookie,
    body: { answers: firstImpression, complete: true },
  });
  for (const { id } of missions) await ok('POST', `${path}/missions/${id}/accept`, { cookie });
  await ok('POST', `${path}/cards`, {
    cookie,
    body: {
      type: 'enjoyed',
      missionId: 'm1',
      comment: 'Found the radio fast.',
      playedSeconds: 492,
    },
  });
  await ok('PUT', `${path}/playtest`, { cookie, body: { playedSeconds: 2280, complete: true } });
  await ok('PUT', `${path}/developer-answers`, { cookie, body: { answers: [], complete: true } });
  await ok('PUT', `${path}/final-verdict`, { cookie, body: { ...verdict, complete: true } });
  await ok('POST', `${path}/submit`, { cookie });
  return review.id;
}

async function poll(check, seconds, description) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await wait(500);
  }
  assert.fail(`Timed out waiting for ${description}`);
}

const rawStatus = (path) =>
  new Promise((resolve, reject) => {
    const { hostname, port } = new URL(GATEWAY);
    http
      .request({ hostname, port, path, method: 'GET' }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      })
      .on('error', reject)
      .end();
  });

const suffix = randomBytes(4).toString('hex');
const developer = await register(`smoke_dev_${suffix}`);
const reviewer = await register(`smoke_rev_${suffix}`);
console.log('ok registered two users');

const gameId = await publishGame(developer.cookie);
console.log('ok published a game with an uploaded cover');

const reviewId = await submitReview(gameId, reviewer.cookie);
console.log('ok submitted a review');

await ok('PUT', `/api/reviews/${reviewId}/vote`, {
  cookie: developer.cookie,
  body: { value: 1 },
});
await poll(
  async () => {
    const { body } = await ok('GET', '/api/me/notifications', { cookie: developer.cookie });
    return body.items.some((item) => item.type === 'review_received' && item.actor);
  },
  10,
  'the review notification',
);
console.log('ok voted and received the notification');

const admin = await ok('POST', '/api/auth/login', {
  body: { email: 'admin@seed.example.com', password: SEED_PASSWORD },
});
await ok('POST', `/api/admin/users/${reviewer.id}/suspend`, {
  cookie: sessionCookie(admin),
  body: { reason: 'Smoke test', until: null },
});
for (const [method, path, body] of [
  ['GET', '/api/me'],
  ['GET', '/api/me/notifications'],
  ['POST', '/api/uploads', avatarUpload],
]) {
  const { status } = await send(method, path, { cookie: reviewer.cookie, body });
  assert.equal(status, 403, `${method} ${path} after a ban`);
}
console.log('ok a ban reached Identity, Community, Notifications and Media');

if (!SMOKE_REMOTE) {
  for (const path of [
    '/internal/accounts/x/access',
    '/api/../internal/accounts/x/access',
    '/api/%2e%2e/internal/accounts/x/access',
    '/internal/../api/health',
    '/internal/%2e%2e/api/health',
  ]) {
    assert.equal(await rawStatus(path), 404, path);
  }
  console.log('ok internal routes are closed at the gateway');

  execSync('docker compose restart community', { stdio: 'ignore' });
  await poll(async () => (await send('GET', '/api/games')).status === 200, 30, 'Community');
  console.log('ok the gateway recovered after a restart');
}

console.log('Smoke test passed');
