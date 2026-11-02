import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, settle, withServiceDown } from './stack.js';
import { notify } from '../../community/src/modules/outbox/outbox.service.js';
import { Notification } from '../../notifications/src/modules/notifications/notification.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

let dev;
let reviewer;
let game;

beforeEach(async () => {
  dev = await createUser({ displayName: 'Enola' });
  reviewer = await createUser({ displayName: 'Kai' });
  game = await createPublishedGame(dev);
});

const inbox = async (user, query = '') => {
  await settle();
  return request(app).get(`/api/me/notifications${query}`).set(as(user));
};

function readyToSubmit() {
  const done = new Date();
  return createSubmittedReview(game, reviewer, {
    status: 'in_progress',
    submittedAt: null,
    firstImpression: {
      completedAt: done,
      answers: [
        { questionId: 'impression', text: 'Looks stormy.' },
        { questionId: 'difficulty', optionId: 'challenging' },
        { questionId: 'strength', optionId: 'visuals' },
        { questionId: 'audience', optionId: 'experienced' },
        { questionId: 'excitement', number: 4 },
      ],
    },
    playtest: { acceptedMissionIds: ['m1', 'm2'], playedSeconds: 600, completedAt: done },
    developerAnswers: { answers: [{ questionId: 'dq1', text: 'Yes' }], completedAt: done },
    finalVerdict: {
      comparison: 'better',
      changeText: 'Better than expected.',
      enjoyment: 5,
      improveCategory: 'ui',
      improveText: 'Bigger map icons.',
      completedAt: done,
    },
  });
}

describe('details from Community', () => {
  async function replyNote() {
    await notify({
      user: dev._id,
      type: 'review_received',
      message: 'New review',
      link: '/x',
      actor: reviewer._id,
      game: game._id,
    });
  }

  it('lists notifications without actor and game when Community is down', async () => {
    await replyNote();
    await settle();

    const res = await withServiceDown('community', () => inbox(dev));

    expect(res.status).toBe(200);
    expect(res.body.items[0].message).toBe('New review');
    expect(res.body.items[0].actor).toBeUndefined();
    expect(res.body.items[0].game).toBeUndefined();
  });

  it('reports a removed game as deleted', async () => {
    await replyNote();
    game.deletedAt = new Date();
    await game.save();

    const res = await inbox(dev);

    expect(res.body.items[0].game.deleted).toBe(true);
    expect(res.body.items[0].actor.displayName).toBe('Kai');
  });
});

describe('triggers', () => {
  it('tells the developer about a new review', async () => {
    const review = await readyToSubmit();
    const res = await request(app).post(`/api/reviews/${review._id}/submit`).set(as(reviewer));
    expect(res.status).toBe(200);

    const { body } = await inbox(dev);
    expect(body.items[0]).toMatchObject({
      type: 'review_received',
      read: false,
      message: 'Kai reviewed Tempest',
      link: `/games/${game.id}/reviews/${review.id}`,
      actor: { id: reviewer.id },
      game: { id: game.id, title: 'Tempest' },
      reviewId: review.id,
    });
  });

  it('tells the reviewer when the developer sets a feedback status', async () => {
    const review = await createSubmittedReview(game, reviewer);
    await request(app)
      .put(`/api/reviews/${review._id}/feedback-status`)
      .set(as(dev))
      .send({ status: 'planned' });

    const { body } = await inbox(reviewer);
    expect(body.items.find((n) => n.type === 'feedback_status_changed')).toMatchObject({
      message: 'Tempest: your feedback is now planned',
      actor: { id: dev.id },
    });
  });

  it('tells the review author and the developer about replies, but never the person replying', async () => {
    const review = await createSubmittedReview(game, reviewer);
    const reader = await createUser({ displayName: 'Mira' });

    await request(app)
      .post(`/api/reviews/${review._id}/replies`)
      .set(as(reader))
      .send({ body: 'Same!' });
    await request(app)
      .post(`/api/reviews/${review._id}/replies`)
      .set(as(dev))
      .send({ body: 'Thanks' });

    const toReviewer = (await inbox(reviewer)).body.items.map((n) => n.message);
    expect(toReviewer).toEqual([
      'Enola replied to your review of Tempest',
      'Mira replied to your review of Tempest',
    ]);
    const toDev = (await inbox(dev)).body.items.map((n) => n.message);
    expect(toDev).toEqual(['Mira replied to a review of Tempest']);
    expect((await inbox(reader)).body.total).toBe(0);
  });
});

describe('the bell', () => {
  beforeEach(async () => {
    for (const message of ['One', 'Two', 'Three']) {
      await Notification.create({ user: dev._id, type: 'review_received', message, link: '/' });
    }
  });

  it('counts unread, marks one or all as read, and filters unread', async () => {
    const count = () => request(app).get('/api/me/notifications/unread-count').set(as(dev));
    expect((await count()).body).toEqual({ count: 3 });

    const { body } = await inbox(dev);
    expect(body).toMatchObject({ total: 3, unreadCount: 3 });
    const read = await request(app)
      .post(`/api/me/notifications/${body.items[0].id}/read`)
      .set(as(dev));
    expect(read.status).toBe(204);
    expect((await count()).body.count).toBe(2);
    expect((await inbox(dev, '?unreadOnly=true')).body.total).toBe(2);

    await request(app).post('/api/me/notifications/read-all').set(as(dev));
    expect((await count()).body.count).toBe(0);
  });

  it("can't mark someone else's notification", async () => {
    const { body } = await inbox(dev);
    const res = await request(app)
      .post(`/api/me/notifications/${body.items[0].id}/read`)
      .set(as(reviewer));
    expect(res.status).toBe(404);
  });
});
