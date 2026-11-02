import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { Game } from '../../community/src/modules/games/game.model.js';
import { authCookie, createUser } from './helpers.js';

const app = createApp();

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

let owner;
let other;

beforeEach(async () => {
  owner = await createUser();
  other = await createUser();
});

const as = (user) => ({ Cookie: authCookie(user) });

async function createDraft(title = 'Tempest') {
  const res = await request(app).post('/api/games').set(as(owner)).send({ title });
  return res.body.id;
}

async function createPublished(title = 'Tempest', extra = {}) {
  const id = await createDraft(title);
  await request(app)
    .patch(`/api/games/${id}`)
    .set(as(owner))
    .send({ ...completeFields, ...extra });
  await request(app)
    .patch(`/api/games/${id}/form`)
    .set(as(owner))
    .send({ playtest: { missions, knownIssues: [], questions: [] } });
  await Game.updateOne({ _id: id }, { media: [{ type: 'image', key: `games/${id}/cover.jpg` }] });
  const res = await request(app).post(`/api/games/${id}/publish`).set(as(owner));
  expect(res.status).toBe(200);
  return id;
}

describe('creating and reading games', () => {
  it('requires login to create', async () => {
    const res = await request(app).post('/api/games').send({ title: 'Tempest' });
    expect(res.status).toBe(401);
  });

  it('creates a draft with the five default First Impression questions', async () => {
    const res = await request(app).post('/api/games').set(as(owner)).send({ title: 'Tempest' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'draft', isOwner: true, version: '0.1' });

    const form = await request(app).get(`/api/games/${res.body.id}/form`).set(as(owner));
    expect(form.status).toBe(200);
    expect(form.body.firstImpression.questions.map((q) => q.preset)).toEqual([
      'impression',
      'difficulty',
      'strength',
      'audience',
      'excitement',
    ]);
  });

  it('hides drafts from everyone except the owner', async () => {
    const id = await createDraft();
    expect((await request(app).get(`/api/games/${id}`)).status).toBe(404);
    expect((await request(app).get(`/api/games/${id}`).set(as(other))).status).toBe(404);
    expect((await request(app).get(`/api/games/${id}`).set(as(owner))).status).toBe(200);
  });
});

describe('ownership', () => {
  it('returns 403 when a non-owner edits, deletes, publishes or reads the form', async () => {
    const id = await createDraft();
    const attempts = [
      request(app).patch(`/api/games/${id}`).set(as(other)).send({ title: 'Mine now' }),
      request(app).delete(`/api/games/${id}`).set(as(other)),
      request(app).post(`/api/games/${id}/publish`).set(as(other)),
      request(app).get(`/api/games/${id}/form`).set(as(other)),
      request(app)
        .patch(`/api/games/${id}/form`)
        .set(as(other))
        .send({ finalVerdict: { farewellMessage: 'hi' } }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403);
  });
});

describe('editing', () => {
  it('updates fields and merges theme changes', async () => {
    const id = await createDraft();
    const res = await request(app)
      .patch(`/api/games/${id}`)
      .set(as(owner))
      .send({ pitch: 'Dive for wreckage.', theme: { accentColor: '#123456' } });
    expect(res.status).toBe(200);
    expect(res.body.pitch).toBe('Dive for wreckage.');
    expect(res.body.theme).toMatchObject({ backgroundPreset: 'sky', accentColor: '#123456' });
  });

  it('rejects unknown genres', async () => {
    const id = await createDraft();
    const res = await request(app)
      .patch(`/api/games/${id}`)
      .set(as(owner))
      .send({ genres: ['cooking'] });
    expect(res.status).toBe(400);
  });

  it('keeps a published game complete', async () => {
    const id = await createPublished();
    const res = await request(app)
      .patch(`/api/games/${id}`)
      .set(as(owner))
      .send({ coreGameplay: [] });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('/coreGameplay');
  });
});

describe('publishing', () => {
  it('lists every missing item', async () => {
    const id = await createDraft();
    const res = await request(app).post(`/api/games/${id}/publish`).set(as(owner));
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.path)).toEqual(
      expect.arrayContaining(['/pitch', '/media', '/form/playtest/missions', '/delivery/method']),
    );
  });

  it('publishes a complete game and can move it back to draft', async () => {
    const id = await createPublished();
    const game = await request(app).get(`/api/games/${id}`);
    expect(game.body).toMatchObject({
      status: 'published',
      playtest: { missionCount: 2, estimatedMinutes: 15 },
    });
    expect(game.body.media[0].url).toBe(`http://media.test/games/${id}/cover.jpg`);

    expect((await request(app).post(`/api/games/${id}/publish`).set(as(owner))).status).toBe(409);
    const draft = await request(app).post(`/api/games/${id}/unpublish`).set(as(owner));
    expect(draft.body.status).toBe('draft');
  });
});

describe('PlayLoop form', () => {
  it('drops a comparable preset when its options change and bumps the revision', async () => {
    const id = await createDraft();
    const { body: form } = await request(app).get(`/api/games/${id}/form`).set(as(owner));
    const [impression, difficulty] = form.firstImpression.questions;
    const edited = { ...difficulty, options: difficulty.options.slice(0, 2) };

    const res = await request(app)
      .patch(`/api/games/${id}/form`)
      .set(as(owner))
      .send({ firstImpression: { questions: [impression, edited] } });
    expect(res.status).toBe(200);
    expect(res.body.revision).toBe(2);
    expect(res.body.firstImpression.questions[0].preset).toBe('impression');
    expect(res.body.firstImpression.questions[1].preset).toBeUndefined();
  });

  it('rejects duplicate question ids', async () => {
    const id = await createDraft();
    const q = { id: 'same', type: 'short_answer', title: 'Why?', required: false };
    const res = await request(app)
      .patch(`/api/games/${id}/form`)
      .set(as(owner))
      .send({ firstImpression: { questions: [q, q] } });
    expect(res.status).toBe(400);
  });

  it('keeps at least one mission on a published game', async () => {
    const id = await createPublished();
    const res = await request(app)
      .patch(`/api/games/${id}/form`)
      .set(as(owner))
      .send({ playtest: { missions: [], knownIssues: [], questions: [] } });
    expect(res.status).toBe(400);
  });
});

describe('browsing', () => {
  it('lists only published games with filters, search and paging', async () => {
    await createDraft('Secret draft');
    await createPublished('Tempest');
    await createPublished('Undertow', { genres: ['horror'], platforms: ['pc'] });

    const all = await request(app).get('/api/games');
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);

    const horror = await request(app).get('/api/games?genre=horror');
    expect(horror.body.items.map((g) => g.title)).toEqual(['Undertow']);

    const either = await request(app).get('/api/games?platform=web&platform=pc');
    expect(either.body.total).toBe(2);

    const search = await request(app).get('/api/games?search=temp');
    expect(search.body.items.map((g) => g.title)).toEqual(['Tempest']);

    const paged = await request(app).get('/api/games?limit=1&page=2');
    expect(paged.body).toMatchObject({ page: 2, limit: 1, total: 2 });
    expect(paged.body.items).toHaveLength(1);
  });

  it('soft-deletes games', async () => {
    const id = await createPublished();
    expect((await request(app).delete(`/api/games/${id}`).set(as(owner))).status).toBe(204);
    expect((await request(app).get(`/api/games/${id}`)).status).toBe(404);
    expect((await request(app).get('/api/games')).body.total).toBe(0);
    expect(await Game.countDocuments({ _id: id })).toBe(1);
  });
});

describe('My Games', () => {
  it('lists drafts and published games with a summary', async () => {
    await createDraft('Undertow');
    await createPublished('Tempest');
    await Game.updateOne({ title: 'Tempest' }, { reviewCount: 12 });

    const res = await request(app).get('/api/me/games').set(as(owner));
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ published: 1, drafts: 1, reviewsReceived: 12 });
    expect(res.body.items).toHaveLength(2);

    const drafts = await request(app).get('/api/me/games?status=draft').set(as(owner));
    expect(drafts.body.items.map((g) => g.title)).toEqual(['Undertow']);
  });
});
