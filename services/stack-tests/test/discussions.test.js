import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { Review } from '../../community/src/modules/reviews/review.model.js';
import { Reaction, Reply } from '../../community/src/modules/discussions/discussion.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

let dev;
let reviewer;
let reader;
let review;

beforeEach(async () => {
  dev = await createUser();
  reviewer = await createUser();
  reader = await createUser();
  const game = await createPublishedGame(dev);
  review = await createSubmittedReview(game, reviewer);
});

const reply = (user, body, reviewId = review._id) =>
  request(app).post(`/api/reviews/${reviewId}/replies`).set(as(user)).send({ body });

const react = (method, user, emoji, targetType = 'review', targetId = review._id) =>
  request(app)[method](`/api/reactions/${targetType}/${targetId}/${emoji}`).set(as(user));

describe('replies', () => {
  it('needs login to reply and counts replies on the review', async () => {
    const anonymous = await request(app)
      .post(`/api/reviews/${review._id}/replies`)
      .send({ body: 'Hi' });
    expect(anonymous.status).toBe(401);

    const res = await reply(dev, 'Thanks! Markers are coming in 0.2.');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ isGameOwner: true, isReviewAuthor: false, edited: false });
    expect((await Review.findById(review._id)).replyCount).toBe(1);
  });

  it('lists replies oldest first for anyone', async () => {
    await reply(reviewer, 'First');
    await reply(reader, 'Second');
    const res = await request(app).get(`/api/reviews/${review._id}/replies`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((r) => r.body)).toEqual(['First', 'Second']);
    expect(res.body.items[0].isReviewAuthor).toBe(true);
  });

  it("doesn't allow replies on unsubmitted reviews", async () => {
    const draft = await Review.findByIdAndUpdate(review._id, { status: 'in_progress' });
    expect((await reply(reader, 'Hi', draft._id)).status).toBe(404);
    expect((await reply(reviewer, 'Hi', draft._id)).status).toBe(404);
  });

  it('only lets the author edit or delete a reply', async () => {
    const { body: created } = await reply(reader, 'Typo hree');
    const edit = (user) =>
      request(app).patch(`/api/replies/${created.id}`).set(as(user)).send({ body: 'Typo here' });

    expect((await edit(dev)).status).toBe(403);
    const edited = await edit(reader);
    expect(edited.body).toMatchObject({ body: 'Typo here', edited: true });

    expect((await request(app).delete(`/api/replies/${created.id}`).set(as(dev))).status).toBe(403);
    await react('put', dev, 'heart', 'reply', created.id);
    expect((await request(app).delete(`/api/replies/${created.id}`).set(as(reader))).status).toBe(
      204,
    );
    expect((await Review.findById(review._id)).replyCount).toBe(0);
    expect(await Reaction.countDocuments()).toBe(0);
  });
});

describe('reactions', () => {
  it('adds one reaction per user and emoji, and removes it', async () => {
    await react('put', reader, 'fire');
    const twice = await react('put', reader, 'fire');
    expect(twice.status).toBe(200);
    expect(twice.body.reactions).toEqual([{ emoji: 'fire', count: 1, reactedByMe: true }]);

    await react('put', dev, 'fire');
    await react('put', dev, 'thumbs_up');
    const view = await request(app).get(`/api/reviews/${review._id}`).set(as(reader));
    expect(view.body.reactions).toEqual([
      { emoji: 'thumbs_up', count: 1, reactedByMe: false },
      { emoji: 'fire', count: 2, reactedByMe: true },
    ]);

    const removed = await react('delete', reader, 'fire');
    expect(removed.body.reactions).toEqual([
      { emoji: 'thumbs_up', count: 1, reactedByMe: false },
      { emoji: 'fire', count: 1, reactedByMe: false },
    ]);
  });

  it('shows reactions in the review list', async () => {
    await react('put', reader, 'clap');
    const res = await request(app).get(`/api/games/${review.game}/reviews`);
    expect(res.body.items[0].reactions).toEqual([{ emoji: 'clap', count: 1, reactedByMe: false }]);
  });

  it('rejects reactions on missing or unsubmitted targets', async () => {
    await Review.updateOne({ _id: review._id }, { status: 'in_progress' });
    expect((await react('put', reader, 'fire')).status).toBe(404);
    expect((await react('put', reader, 'fire', 'reply', review._id)).status).toBe(404);
  });
});

describe('deleting a review', () => {
  it('removes its replies and reactions', async () => {
    const { body: created } = await reply(dev, 'Thanks');
    await react('put', reader, 'heart');
    await react('put', reader, 'heart', 'reply', created.id);

    expect((await request(app).delete(`/api/reviews/${review._id}`).set(as(reviewer))).status).toBe(
      204,
    );
    expect(await Reply.countDocuments()).toBe(0);
    expect(await Reaction.countDocuments()).toBe(0);
  });
});
