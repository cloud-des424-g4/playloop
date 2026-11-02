import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { User } from '../../community/src/modules/users/user.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

let dev;
let reviewer;
let game;

beforeEach(async () => {
  dev = await createUser();
  reviewer = await createUser();
  game = await createPublishedGame(dev);
});

const setStatus = (reviewId, status, user = dev) =>
  request(app).put(`/api/reviews/${reviewId}/feedback-status`).set(as(user)).send({ status });

const points = async () => (await User.findById(reviewer._id)).reputationPoints;

describe('Feedback Inbox', () => {
  it('is only for the game owner', async () => {
    const res = await request(app).get(`/api/games/${game._id}/feedback`).set(as(reviewer));
    expect(res.status).toBe(403);
  });

  it('lists submitted reviews with counts per status and filters by status', async () => {
    const other = await createUser();
    await createSubmittedReview(game, reviewer, { feedbackStatus: 'planned' });
    await createSubmittedReview(game, other);
    await createSubmittedReview(game, await createUser(), {
      status: 'in_progress',
      submittedAt: null,
    });

    const all = await request(app).get(`/api/games/${game._id}/feedback`).set(as(dev));
    expect(all.status).toBe(200);
    expect(all.body.counts).toEqual({ all: 2, new: 1, reviewed: 0, planned: 1, fixed: 0 });
    expect(all.body.items[0]).toMatchObject({
      excerpt: 'Froze when lightning hit the tower.',
      playedSeconds: 2280,
    });

    const planned = await request(app)
      .get(`/api/games/${game._id}/feedback?status=planned`)
      .set(as(dev));
    expect(planned.body.total).toBe(1);
    expect(planned.body.items[0].reviewer.id).toBe(reviewer._id.toString());
  });
});

describe('feedback status', () => {
  it('can only be set by the game owner on submitted reviews', async () => {
    const review = await createSubmittedReview(game, reviewer);
    expect((await setStatus(review._id, 'reviewed', reviewer)).status).toBe(403);

    const draft = await createSubmittedReview(game, await createUser(), { status: 'in_progress' });
    expect((await setStatus(draft._id, 'reviewed')).status).toBe(409);
  });

  it('gives the planned and fixed bonus once and takes it back when the status changes', async () => {
    const review = await createSubmittedReview(game, reviewer);

    const res = await setStatus(review._id, 'planned');
    expect(res.status).toBe(200);
    expect(res.body.feedbackStatus).toBe('planned');
    expect(await points()).toBe(5);

    await setStatus(review._id, 'fixed');
    expect(await points()).toBe(15);
    await setStatus(review._id, 'fixed');
    expect(await points()).toBe(15);

    await setStatus(review._id, 'reviewed');
    expect(await points()).toBe(0);
  });

  it('shows new reviews on My Games until the developer sets a status', async () => {
    const review = await createSubmittedReview(game, reviewer);
    const before = await request(app).get('/api/me/games').set(as(dev));
    expect(before.body.items[0].newReviewCount).toBe(1);

    await setStatus(review._id, 'reviewed');
    const after = await request(app).get('/api/me/games').set(as(dev));
    expect(after.body.items[0].newReviewCount).toBe(0);
  });
});
