import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { User } from '../../community/src/modules/users/user.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

describe('votes and reputation', () => {
  let dev;
  let reviewer;
  let game;
  let review;

  beforeEach(async () => {
    dev = await createUser();
    reviewer = await createUser();
    game = await createPublishedGame(dev);
    review = await createSubmittedReview(game, reviewer);
  });

  const vote = (value, user = dev) =>
    request(app).put(`/api/reviews/${review._id}/vote`).set(as(user)).send({ value });

  const points = () => User.findById(reviewer._id).then((user) => user.reputationPoints);

  it('keeps one vote per person and does not pay back a penalty that never landed', async () => {
    const helpful = await vote(1);
    expect(helpful.status).toBe(200);
    expect(helpful.body).toMatchObject({ helpfulCount: 1, notHelpfulCount: 0, myVote: 1 });
    expect(await points()).toBe(10);

    const again = await vote(1);
    expect(again.body).toMatchObject({ helpfulCount: 1, myVote: 1 });
    expect(await points()).toBe(10);

    const down = await vote(-1);
    expect(down.body).toMatchObject({ helpfulCount: 0, notHelpfulCount: 1, myVote: -1 });
    expect(await points()).toBe(0);

    await request(app).delete(`/api/reviews/${review._id}/vote`).set(as(dev));
    expect(await points()).toBe(0);

    const own = await vote(1, reviewer);
    expect(own.status).toBe(403);

    const fresh = await createSubmittedReview(game, await createUser(), { gameVersion: '0.2' });
    const penalty = await request(app)
      .put(`/api/reviews/${fresh._id}/vote`)
      .set(as(dev))
      .send({ value: -1 });
    expect(penalty.body).toMatchObject({ notHelpfulCount: 1, myVote: -1 });
    const author = await User.findById(fresh.reviewer);
    expect(author.reputationPoints).toBe(0);
    await request(app).delete(`/api/reviews/${fresh._id}/vote`).set(as(dev));
    expect((await User.findById(fresh.reviewer)).reputationPoints).toBe(0);
  });

  it('lists the review, records a level up, and shows the leaderboard', async () => {
    await User.updateOne({ _id: reviewer._id }, { reputationPoints: 95 });
    await vote(1);

    const listed = await request(app).get(`/api/games/${game._id}/reviews`).set(as(dev));
    expect(listed.status).toBe(200);
    expect(listed.body.items[0]).toMatchObject({
      id: review._id.toString(),
      helpfulCount: 1,
      myVote: 1,
    });

    const notes = await request(app).get('/api/me/notifications').set(as(reviewer));
    expect(notes.body.items.some((item) => item.type === 'level_up')).toBe(true);

    const board = await request(app).get('/api/leaderboard');
    expect(board.status).toBe(200);
    expect(board.body.items[0]).toMatchObject({
      rank: 1,
      points: 105,
      user: { username: reviewer.username },
    });

    const profile = await request(app).get(`/api/users/${reviewer.username}`);
    expect(profile.body.badges.map((badge) => badge.key)).toContain('hall_of_fame');
    expect(profile.body.stats.helpfulVotes).toBe(1);
  });
});

describe('discussions and notifications', () => {
  let dev;
  let reviewer;
  let other;
  let game;
  let review;

  beforeEach(async () => {
    dev = await createUser();
    reviewer = await createUser();
    other = await createUser();
    game = await createPublishedGame(dev);
    review = await createSubmittedReview(game, reviewer);
  });

  it('lets people reply and react, and notifies the people involved', async () => {
    const created = await request(app)
      .post(`/api/reviews/${review._id}/replies`)
      .set(as(dev))
      .send({ body: 'The facility markers land in 0.2.' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      isGameOwner: true,
      isReviewAuthor: false,
      edited: false,
      body: 'The facility markers land in 0.2.',
    });

    const forbidden = await request(app)
      .patch(`/api/replies/${created.body.id}`)
      .set(as(other))
      .send({ body: 'changed' });
    expect(forbidden.status).toBe(403);

    const edited = await request(app)
      .patch(`/api/replies/${created.body.id}`)
      .set(as(dev))
      .send({ body: 'Markers land in 0.2.' });
    expect(edited.body).toMatchObject({ edited: true, body: 'Markers land in 0.2.' });

    const reaction = await request(app)
      .put(`/api/reactions/reply/${created.body.id}/heart`)
      .set(as(reviewer));
    expect(reaction.status).toBe(200);
    expect(reaction.body.reactions).toEqual([{ emoji: 'heart', count: 1, reactedByMe: true }]);

    await request(app).put(`/api/reactions/reply/${created.body.id}/heart`).set(as(reviewer));
    const removed = await request(app)
      .delete(`/api/reactions/reply/${created.body.id}/heart`)
      .set(as(reviewer));
    expect(removed.body.reactions).toEqual([]);

    const list = await request(app).get(`/api/reviews/${review._id}/replies`);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].id).toBe(created.body.id);

    const bell = await request(app).get('/api/me/notifications').set(as(reviewer));
    expect(bell.body.unreadCount).toBeGreaterThan(0);
    const replyNote = bell.body.items.find((item) => item.type === 'reply_received');
    expect(replyNote.read).toBe(false);

    const marked = await request(app)
      .post(`/api/me/notifications/${replyNote.id}/read`)
      .set(as(reviewer));
    expect(marked.status).toBe(204);
    await request(app).post('/api/me/notifications/read-all').set(as(reviewer));
    const after = await request(app).get('/api/me/notifications/unread-count').set(as(reviewer));
    expect(after.body.count).toBe(0);

    const deleted = await request(app).delete(`/api/replies/${created.body.id}`).set(as(dev));
    expect(deleted.status).toBe(204);
    const empty = await request(app).get(`/api/reviews/${review._id}/replies`);
    expect(empty.body.total).toBe(0);

    const draft = await createSubmittedReview(game, other, {
      status: 'in_progress',
      submittedAt: null,
      gameVersion: '9.9',
    });
    const hidden = await request(app)
      .post(`/api/reviews/${draft._id}/replies`)
      .set(as(dev))
      .send({ body: 'too early' });
    expect(hidden.status).toBe(404);
  });
});
