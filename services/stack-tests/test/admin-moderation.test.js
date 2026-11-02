import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { Reply } from '../../community/src/modules/discussions/discussion.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });
const DAY = 24 * 60 * 60 * 1000;

let admin;
let dev;
let player;

beforeEach(async () => {
  admin = await createUser({ role: 'admin' });
  dev = await createUser({ username: 'pixeldev' });
  player = await createUser({ username: 'oceanplayer' });
});

function report(user, targetType, targetId) {
  return request(app)
    .post('/api/reports')
    .set(as(user))
    .send({ targetType, targetId: targetId.toString(), reason: 'spam' });
}

describe('content moderation list', () => {
  it('lists games, reviews and replies with status, open reports and the last action', async () => {
    const game = await createPublishedGame(dev, { title: 'Tidebound' });
    const review = await createSubmittedReview(game, player);
    const reply = await Reply.create({
      review: review._id,
      game: game._id,
      author: dev._id,
      body: 'Thanks, fixing the storm crash.',
    });
    await report(player, 'game', game._id);
    await request(app)
      .post(`/api/admin/content/review/${review._id}/hide`)
      .set(as(admin))
      .send({ reason: 'Spam' });

    const all = await request(app).get('/api/admin/content').set(as(admin));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((item) => item.type)).toEqual(['reply', 'review', 'game']);
    expect(all.body.items[1]).toMatchObject({
      type: 'review',
      id: review.id,
      title: 'Tidebound',
      status: 'hidden',
      reason: 'Spam',
      lastAction: { action: 'hide', actor: { id: admin.id } },
    });
    const gameRow = all.body.items.find((item) => item.type === 'game');
    expect(gameRow).toMatchObject({ status: 'visible', excerpt: null, openReportCount: 1 });
    expect(gameRow.lastAction).toBeUndefined();

    const second = await request(app)
      .get('/api/admin/content')
      .query({ page: 2, limit: 1 })
      .set(as(admin));
    expect(second.body.items.map((item) => item.id)).toEqual([all.body.items[1].id]);

    const hidden = await request(app).get('/api/admin/content?status=hidden').set(as(admin));
    expect(hidden.body.items.map((item) => item.id)).toEqual([review.id]);

    const replies = await request(app)
      .get('/api/admin/content')
      .query({ type: 'reply', search: 'storm crash' })
      .set(as(admin));
    expect(replies.body.items).toHaveLength(1);
    expect(replies.body.items[0]).toMatchObject({
      id: reply.id,
      excerpt: 'Thanks, fixing the storm crash.',
      link: `/games/${game.id}/reviews/${review.id}`,
    });

    const byAuthor = await request(app).get('/api/admin/content?search=oceanplayer').set(as(admin));
    expect(byAuthor.body.items.map((item) => item.type)).toEqual(['review']);
  });
});

describe('moderation history', () => {
  it('records admin actions newest first and filters them per target', async () => {
    const game = await createPublishedGame(dev);
    const filed = await report(player, 'game', game._id);
    await request(app)
      .post(`/api/admin/content/game/${game._id}/hide`)
      .set(as(admin))
      .send({ reason: 'Broken download' });
    await request(app).post(`/api/admin/content/game/${game._id}/restore`).set(as(admin));
    await request(app)
      .patch(`/api/admin/reports/${filed.body.id}`)
      .set(as(admin))
      .send({ status: 'dismissed', note: 'Not spam' });

    const until = new Date(Date.now() + DAY).toISOString();
    await request(app)
      .post(`/api/admin/users/${player._id}/suspend`)
      .set(as(admin))
      .send({ reason: 'Spam reviews', until });
    await request(app).post(`/api/admin/users/${player._id}/unsuspend`).set(as(admin));
    await request(app)
      .put(`/api/admin/users/${player._id}/role`)
      .set(as(admin))
      .send({ role: 'admin' });

    const gameHistory = await request(app)
      .get('/api/admin/history')
      .query({ targetType: 'game', targetId: game.id })
      .set(as(admin));
    expect(gameHistory.status).toBe(200);
    expect(gameHistory.body.items.map((item) => item.action)).toEqual([
      'report_dismissed',
      'restore',
      'hide',
    ]);
    expect(gameHistory.body.items[0].reason).toBe('Not spam');
    expect(gameHistory.body.items[2]).toMatchObject({
      reason: 'Broken download',
      actor: { id: admin.id },
    });

    const userHistory = await request(app)
      .get('/api/admin/history')
      .query({ targetType: 'user', targetId: player.id })
      .set(as(admin));
    expect(userHistory.body.items.map((item) => item.action)).toEqual([
      'role_change',
      'lift',
      'suspend',
    ]);
    expect(userHistory.body.items[0].role).toBe('admin');
    expect(userHistory.body.items[2]).toMatchObject({ reason: 'Spam reviews', until });

    const everything = await request(app).get('/api/admin/history').set(as(admin));
    expect(everything.body.total).toBe(6);
    expect((await request(app).get('/api/admin/history').set(as(dev))).status).toBe(403);
  });
});

describe('featured game candidates', () => {
  it('lists games that can be featured with playtest, report and featured info', async () => {
    const tempest = await createPublishedGame(dev, { title: 'Tempest' });
    const tidebound = await createPublishedGame(dev, { title: 'Tidebound' });
    await createPublishedGame(dev, { title: 'Hidden Jam', hiddenAt: new Date() });
    await createSubmittedReview(tidebound, player);
    await createSubmittedReview(tidebound, await createUser(), {
      status: 'in_progress',
      submittedAt: null,
    });
    await report(player, 'game', tidebound._id);
    await request(app)
      .put('/api/admin/featured')
      .set(as(admin))
      .send({ gameIds: [tempest.id] });

    const res = await request(app).get('/api/admin/games?sort=playtests').set(as(admin));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((item) => item.game.title)).toEqual(['Tidebound', 'Tempest']);
    expect(res.body.items[0]).toMatchObject({
      playtestCount: 2,
      openReportCount: 1,
      featured: false,
    });
    expect(res.body.items[1]).toMatchObject({
      playtestCount: 0,
      openReportCount: 0,
      featured: true,
    });

    const search = await request(app).get('/api/admin/games?search=temp').set(as(admin));
    expect(search.body.items.map((item) => item.game.id)).toEqual([tempest.id]);
  });
});

describe('suspensions in admin views', () => {
  it('treats ended suspensions as active and counts bans separately', async () => {
    const ended = await createUser({
      status: 'suspended',
      suspension: { reason: 'Spam', until: new Date(Date.now() - 1000), at: new Date() },
    });
    await createUser({
      status: 'suspended',
      suspension: { reason: 'Spam', until: new Date(Date.now() + DAY), at: new Date() },
    });
    await createUser({
      status: 'banned',
      suspension: { reason: 'Bot', until: null, at: new Date() },
    });

    const stats = await request(app).get('/api/admin/stats').set(as(admin));
    expect(stats.body.totals).toMatchObject({ suspendedUsers: 1, bannedUsers: 1 });

    const suspended = await request(app).get('/api/admin/users?status=suspended').set(as(admin));
    expect(suspended.body.total).toBe(1);

    const user = await request(app).get(`/api/admin/users/${ended._id}`).set(as(admin));
    expect(user.body.status).toBe('active');
    expect(user.body.suspension).toBeUndefined();

    const byId = await request(app)
      .get('/api/admin/users')
      .query({ search: ended.id })
      .set(as(admin));
    expect(byId.body.items.map((item) => item.id)).toEqual([ended.id]);
  });
});
