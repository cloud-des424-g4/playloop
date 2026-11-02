import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { Game } from '../../community/src/modules/games/game.model.js';
import { authCookie, createPublishedGame, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

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

let dev;
let reviewer;
let game;

beforeEach(async () => {
  dev = await createUser();
  reviewer = await createUser();
  game = await createPublishedGame(dev);
});

const start = (user = reviewer, gameId = game._id) =>
  request(app).post(`/api/games/${gameId}/reviews`).set(as(user));

const put = (id, stage, body, user = reviewer) =>
  request(app).put(`/api/reviews/${id}/${stage}`).set(as(user)).send(body);

async function playThrough(id) {
  await put(id, 'first-impression', { answers: firstImpression, complete: true });
  for (const mission of ['m1', 'm2']) {
    await request(app).post(`/api/reviews/${id}/missions/${mission}/accept`).set(as(reviewer));
  }
  await request(app).post(`/api/reviews/${id}/cards`).set(as(reviewer)).send({
    type: 'enjoyed',
    missionId: 'm1',
    comment: 'Found the radio fast.',
    playedSeconds: 492,
  });
  await put(id, 'playtest', { playedSeconds: 2280, complete: true });
  await put(id, 'developer-answers', {
    answers: [{ questionId: 'dq1', text: 'Yes, very.' }],
    complete: true,
  });
  await put(id, 'final-verdict', { ...verdict, complete: true });
}

describe('starting a review', () => {
  it('snapshots the form and resumes the same draft', async () => {
    const first = await start();
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      status: 'in_progress',
      currentStep: 'first_impression',
      isReviewer: true,
    });
    expect(first.body.form.playtest.missions).toHaveLength(2);

    const again = await start();
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
  });

  it("doesn't let developers review their own game or anyone review a draft", async () => {
    expect((await start(dev)).status).toBe(403);
    const draft = await createPublishedGame(dev, { status: 'draft' });
    expect((await start(reviewer, draft._id)).status).toBe(404);
  });

  it('allows one review per version', async () => {
    const { body } = await start();
    await playThrough(body.id);
    expect(
      (await request(app).post(`/api/reviews/${body.id}/submit`).set(as(reviewer))).status,
    ).toBe(200);

    expect((await start()).status).toBe(409);
    await Game.updateOne({ _id: game._id }, { version: '0.2' });
    expect((await start()).status).toBe(201);
  });

  it('keeps the snapshot when the developer edits the form later', async () => {
    const { body } = await start();
    await Game.updateOne({ _id: game._id }, { 'form.playtest.missions': [] });
    const review = await request(app).get(`/api/reviews/${body.id}`).set(as(reviewer));
    expect(review.body.form.playtest.missions).toHaveLength(2);
  });
});

describe('visibility and ownership', () => {
  it('hides drafts from everyone but the reviewer', async () => {
    const { body } = await start();
    expect((await request(app).get(`/api/reviews/${body.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/reviews/${body.id}`).set(as(dev))).status).toBe(404);
  });

  it('rejects writes from anyone but the reviewer', async () => {
    const { body } = await start();
    expect((await put(body.id, 'first-impression', { answers: [] }, dev)).status).toBe(403);
    expect((await request(app).delete(`/api/reviews/${body.id}`).set(as(dev))).status).toBe(403);
  });
});

describe('First Impression', () => {
  it('saves partial answers and checks required ones on complete', async () => {
    const { body } = await start();
    expect(
      (await put(body.id, 'first-impression', { answers: firstImpression.slice(0, 1) })).status,
    ).toBe(200);

    const incomplete = await put(body.id, 'first-impression', {
      answers: firstImpression.slice(0, 1),
      complete: true,
    });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.details).toHaveLength(4);

    const done = await put(body.id, 'first-impression', {
      answers: firstImpression,
      complete: true,
    });
    expect(done.status).toBe(200);
    expect(done.body.completedAt).toBeDefined();
  });

  it('rejects answers that do not fit the question', async () => {
    const { body } = await start();
    const bad = [
      { questionId: 'nope', text: 'x' },
      { questionId: 'difficulty', optionId: 'impossible' },
      { questionId: 'excitement', number: 9 },
      { questionId: 'impression', number: 3 },
    ];
    const res = await put(body.id, 'first-impression', { answers: bad });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveLength(4);
  });
});

describe('playtest', () => {
  it('needs a completed First Impression', async () => {
    const { body } = await start();
    const res = await request(app)
      .post(`/api/reviews/${body.id}/missions/m1/accept`)
      .set(as(reviewer));
    expect(res.status).toBe(409);
  });

  it('only takes cards for accepted missions and keeps them editable', async () => {
    const { body } = await start();
    await put(body.id, 'first-impression', { answers: firstImpression, complete: true });
    const card = {
      type: 'bug',
      missionId: 'm1',
      comment: 'Froze on lightning.',
      playedSeconds: 60,
    };

    expect(
      (await request(app).post(`/api/reviews/${body.id}/cards`).set(as(reviewer)).send(card))
        .status,
    ).toBe(409);
    await request(app).post(`/api/reviews/${body.id}/missions/m1/accept`).set(as(reviewer));
    const added = await request(app)
      .post(`/api/reviews/${body.id}/cards`)
      .set(as(reviewer))
      .send(card);
    expect(added.status).toBe(201);

    const edited = await request(app)
      .patch(`/api/reviews/${body.id}/cards/${added.body.id}`)
      .set(as(reviewer))
      .send({ type: 'confused' });
    expect(edited.body).toMatchObject({ type: 'confused', comment: 'Froze on lightning.' });

    expect(
      (
        await request(app)
          .delete(`/api/reviews/${body.id}/cards/${added.body.id}`)
          .set(as(reviewer))
      ).status,
    ).toBe(204);
  });

  it('needs every mission accepted before finishing', async () => {
    const { body } = await start();
    await put(body.id, 'first-impression', { answers: firstImpression, complete: true });
    await request(app).post(`/api/reviews/${body.id}/missions/m1/accept`).set(as(reviewer));
    const res = await put(body.id, 'playtest', { complete: true });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toContain('Reach the research facility');
  });
});

describe('later stages and submit', () => {
  it('enforces the stage order', async () => {
    const { body } = await start();
    expect((await put(body.id, 'developer-answers', { answers: [] })).status).toBe(409);
    expect((await put(body.id, 'final-verdict', { comparison: 'better' })).status).toBe(409);
  });

  it('checks the final verdict on complete', async () => {
    const { body } = await start();
    await playThrough(body.id);
    const res = await put(body.id, 'final-verdict', { improveCategory: 'other', complete: true });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.path)).toContain('/body/improveOther');
  });

  it('submits once, counts the review and locks it', async () => {
    const { body } = await start();
    expect(
      (await request(app).post(`/api/reviews/${body.id}/submit`).set(as(reviewer))).status,
    ).toBe(400);

    await playThrough(body.id);
    const submitted = await request(app).post(`/api/reviews/${body.id}/submit`).set(as(reviewer));
    expect(submitted.status).toBe(200);
    expect(submitted.body).toMatchObject({
      status: 'submitted',
      currentStep: 'summary',
      expectations: { difficulty: 'challenging', strength: 'visuals', audience: 'experienced' },
    });
    expect((await Game.findById(game._id)).reviewCount).toBe(1);

    expect(
      (await request(app).post(`/api/reviews/${body.id}/submit`).set(as(reviewer))).status,
    ).toBe(409);
    expect((await put(body.id, 'final-verdict', { enjoyment: 1 })).status).toBe(409);

    const publicView = await request(app).get(`/api/reviews/${body.id}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.playtest.cards).toHaveLength(1);
  });

  it('uncounts a submitted review when it is deleted', async () => {
    const { body } = await start();
    await playThrough(body.id);
    await request(app).post(`/api/reviews/${body.id}/submit`).set(as(reviewer));
    expect((await request(app).delete(`/api/reviews/${body.id}`).set(as(reviewer))).status).toBe(
      204,
    );
    expect((await Game.findById(game._id)).reviewCount).toBe(0);
  });
});

describe('my reviews', () => {
  it('lists drafts with the step to resume', async () => {
    const { body } = await start();
    await put(body.id, 'first-impression', { answers: firstImpression, complete: true });
    const res = await request(app).get('/api/me/reviews?status=in_progress').set(as(reviewer));
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      id: body.id,
      currentStep: 'playtest',
      game: { title: 'Tempest' },
    });
  });
});
