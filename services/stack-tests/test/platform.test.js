import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, settle } from './stack.js';
import { User } from '../../community/src/modules/users/user.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

describe('accounts and profiles', () => {
  it('registers, logs in with a username, and returns the private profile', async () => {
    const created = await request(app).post('/api/auth/register').send({
      username: 'enolaholmes',
      email: 'enola@example.com',
      password: 'storm-chaser',
      acceptTerms: true,
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      username: 'enolaholmes',
      email: 'enola@example.com',
      role: 'user',
      reputation: { points: 0, level: 1, title: 'Rookie' },
    });

    const cookie = created.headers['set-cookie'];
    const me = await request(app).get('/api/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('enolaholmes');

    await request(app).post('/api/auth/logout').set('Cookie', cookie);
    const loggedOut = await request(app).post('/api/auth/login').send({
      email: 'enolaholmes',
      password: 'storm-chaser',
    });
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.body.email).toBe('enola@example.com');
  });

  it('rejects a taken username and a public profile for an unknown user', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'enolaholmes',
      email: 'enola@example.com',
      password: 'storm-chaser',
      acceptTerms: true,
    });
    const again = await request(app).post('/api/auth/register').send({
      username: 'enolaholmes',
      email: 'other@example.com',
      password: 'storm-chaser',
      acceptTerms: true,
    });
    expect(again.status).toBe(409);

    const missing = await request(app).get('/api/users/nobody');
    expect(missing.status).toBe(404);
  });
});

describe('votes, roulette, reports and admin', () => {
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

  it('applies one helpful vote, lets the voter change it, and refuses a self vote', async () => {
    const helpful = await request(app)
      .put(`/api/reviews/${review._id}/vote`)
      .set(as(dev))
      .send({ value: 1 });
    expect(helpful.status).toBe(200);
    expect(helpful.body).toMatchObject({ helpfulCount: 1, notHelpfulCount: 0, myVote: 1 });
    expect((await User.findById(reviewer._id)).reputationPoints).toBe(10);

    const changed = await request(app)
      .put(`/api/reviews/${review._id}/vote`)
      .set(as(dev))
      .send({ value: -1 });
    expect(changed.body).toMatchObject({ helpfulCount: 0, notHelpfulCount: 1, myVote: -1 });
    expect((await User.findById(reviewer._id)).reputationPoints).toBe(0);

    const removed = await request(app).delete(`/api/reviews/${review._id}/vote`).set(as(dev));
    expect(removed.body.myVote).toBeNull();

    const own = await request(app)
      .put(`/api/reviews/${review._id}/vote`)
      .set(as(reviewer))
      .send({ value: 1 });
    expect(own.status).toBe(403);
  });

  it('says when roulette has no matching game and blocks reporting your own game', async () => {
    const spin = await request(app).post('/api/roulette/spin').set(as(dev)).send({});
    expect(spin.status).toBe(404);
    expect(spin.body.code).toBe('NO_MATCH');

    const stranger = await createUser();
    const match = await request(app)
      .post('/api/roulette/spin')
      .set(as(stranger))
      .send({ platform: 'web' });
    expect(match.status).toBe(200);
    expect(match.body.game.id).toBe(game._id.toString());

    const report = await request(app)
      .post('/api/reports')
      .set(as(dev))
      .send({ targetType: 'game', targetId: game._id.toString(), reason: 'spam' });
    expect(report.status).toBe(403);

    const filed = await request(app)
      .post('/api/reports')
      .set(as(reviewer))
      .send({ targetType: 'game', targetId: game._id.toString(), reason: 'spam' });
    expect(filed.status).toBe(201);

    const reply = await request(app)
      .post(`/api/reviews/${review._id}/replies`)
      .set(as(dev))
      .send({ body: 'The facility markers land in 0.2.' });
    expect(reply.status).toBe(201);
    expect(reply.body.isGameOwner).toBe(true);

    const accepted = await request(app)
      .post('/api/roulette/accept')
      .set(as(stranger))
      .send({ spinToken: match.body.spinToken });
    expect(accepted.status).toBe(201);
    expect(accepted.body.origin).toBe('roulette');

    await settle();
    const bell = await request(app).get('/api/me/notifications/unread-count').set(as(reviewer));
    expect(bell.body.count).toBeGreaterThan(0);
  });

  it('keeps admin stats and settings to admins', async () => {
    const forbidden = await request(app).get('/api/admin/stats').set(as(dev));
    expect(forbidden.status).toBe(403);

    const admin = await createUser({ role: 'admin' });
    const stats = await request(app).get('/api/admin/stats').set(as(admin));
    expect(stats.status).toBe(200);
    expect(stats.body.totals.publishedGames).toBeGreaterThanOrEqual(1);

    const meta = await request(app).get('/api/meta');
    expect(meta.status).toBe(200);
    expect(meta.body.genres.map((genre) => genre.key)).toContain('tactical');
  });
});
