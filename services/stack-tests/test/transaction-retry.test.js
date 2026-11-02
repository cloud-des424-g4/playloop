import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './stack.js';
import { Review } from '../../community/src/modules/reviews/review.model.js';
import {
  authCookie,
  createPublishedGame,
  createReadyReview,
  createSubmittedReview,
  createUser,
} from './helpers.js';

const app = createApp();
const { ClientSession, MongoServerError } = mongoose.mongo;
const as = (user) => ({ Cookie: authCookie(user) });

function failNextCommit() {
  vi.spyOn(ClientSession.prototype, 'commitTransaction').mockImplementationOnce(async function () {
    await this.abortTransaction();
    throw new MongoServerError({
      message: 'Forced commit failure',
      code: 112,
      errorLabels: ['TransientTransactionError'],
    });
  });
}

describe('a commit that has to be retried', () => {
  let dev;
  let reviewer;
  let game;
  let review;

  beforeEach(async () => {
    dev = await createUser();
    reviewer = await createUser();
    game = await createPublishedGame(dev);
    review = await createSubmittedReview(game, reviewer);
    failNextCommit();
  });

  afterEach(() => vi.restoreAllMocks());

  const stored = () => Review.findById(review._id);

  it('keeps the vote count', async () => {
    const res = await request(app)
      .put(`/api/reviews/${review._id}/vote`)
      .set(as(dev))
      .send({ value: 1 });
    expect(res.status).toBe(200);
    expect((await stored()).helpfulCount).toBe(1);
  });

  it('keeps the submitted status', async () => {
    await Review.deleteOne({ _id: review._id });
    review = await createReadyReview(game, reviewer);
    const res = await request(app).post(`/api/reviews/${review._id}/submit`).set(as(reviewer));
    expect(res.status).toBe(200);
    expect((await stored()).status).toBe('submitted');
  });

  it('keeps the feedback status', async () => {
    const res = await request(app)
      .put(`/api/reviews/${review._id}/feedback-status`)
      .set(as(dev))
      .send({ status: 'planned' });
    expect(res.status).toBe(200);
    expect((await stored()).feedbackStatus).toBe('planned');
  });

  it('clears the hidden flag on removed content', async () => {
    await Review.updateOne({ _id: review._id }, { hiddenAt: new Date() });
    const admin = await createUser({ role: 'admin' });
    const res = await request(app).delete(`/api/admin/content/review/${review._id}`).set(as(admin));
    expect(res.status).toBe(204);
    expect(await stored()).toMatchObject({ hiddenAt: null, removedAt: expect.any(Date) });
  });
});
