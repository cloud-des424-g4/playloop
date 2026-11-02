import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, settle } from './stack.js';
import { Build } from '../../community/src/modules/builds/build.model.js';
import { Upload } from '../../media/src/modules/uploads/upload.model.js';
import { Notification } from '../../notifications/src/modules/notifications/notification.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

function sign(body) {
  return createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
}

describe('roulette and recommendations', () => {
  it('skips your own games, honors the time limit, and accepts only your spin', async () => {
    const dev = await createUser();
    const player = await createUser();
    const game = await createPublishedGame(dev);

    const own = await request(app).post('/api/roulette/spin').set(as(dev)).send({});
    expect(own.status).toBe(404);
    expect(own.body.code).toBe('NO_MATCH');

    await game.updateOne({ 'form.playtest.missions.0.minutes': 90 });
    const tooShort = await request(app)
      .post('/api/roulette/spin')
      .set(as(player))
      .send({ maxMinutes: 15 });
    expect(tooShort.body.code).toBe('NO_MATCH');
    await game.updateOne({ 'form.playtest.missions.0.minutes': 5 });

    const match = await request(app)
      .post('/api/roulette/spin')
      .set(as(player))
      .send({ platform: 'web', genres: ['survival'] });
    expect(match.status).toBe(200);
    expect(match.body.game).toMatchObject({
      id: game._id.toString(),
      missionCount: 2,
      estimatedMinutes: 15,
    });

    const skipped = await request(app)
      .post('/api/roulette/spin')
      .set(as(player))
      .send({ exclude: [game._id.toString()] });
    expect(skipped.body.code).toBe('NO_MATCH');

    const stolen = await request(app)
      .post('/api/roulette/accept')
      .set(as(dev))
      .send({ spinToken: match.body.spinToken });
    expect(stolen.status).toBe(400);

    const accepted = await request(app)
      .post('/api/roulette/accept')
      .set(as(player))
      .send({ spinToken: match.body.spinToken });
    expect(accepted.status).toBe(201);
    expect(accepted.body.origin).toBe('roulette');
  });

  it('shows featured games first when nobody is logged in', async () => {
    const dev = await createUser();
    const admin = await createUser({ role: 'admin' });
    const featured = await createPublishedGame(dev, { title: 'Featured storm' });
    await createPublishedGame(dev, { title: 'Other storm', genres: ['horror'] });

    const saved = await request(app)
      .put('/api/admin/featured')
      .set(as(admin))
      .send({ gameIds: [featured._id.toString()] });
    expect(saved.status).toBe(200);

    const recommendations = await request(app).get('/api/recommendations');
    expect(recommendations.body.items[0].id).toBe(featured._id.toString());
  });
});

describe('moderation', () => {
  let dev;
  let player;
  let admin;
  let game;

  beforeEach(async () => {
    dev = await createUser();
    player = await createUser();
    admin = await createUser({ role: 'admin' });
    game = await createPublishedGame(dev);
  });

  it('hides a game from everyone except the owner and admins, then restores it', async () => {
    const review = await createSubmittedReview(game, player);
    const hidden = await request(app)
      .post(`/api/admin/content/game/${game._id}/hide`)
      .set(as(admin))
      .send({ reason: 'Broken download' });
    expect(hidden.status).toBe(200);
    expect(hidden.body).toMatchObject({ hidden: true, removed: false });

    expect((await request(app).get(`/api/games/${game._id}`)).status).toBe(404);
    expect((await request(app).get(`/api/games/${game._id}`).set(as(dev))).status).toBe(200);
    expect((await request(app).get(`/api/games/${game._id}`).set(as(admin))).status).toBe(200);
    const browse = await request(app).get('/api/games');
    expect(browse.body.items.map((item) => item.id)).not.toContain(game._id.toString());

    await settle();
    const note = await Notification.findOne({ user: dev._id, type: 'content_hidden' });
    expect(note.message).toContain('Broken download');

    const reviewHidden = await request(app)
      .post(`/api/admin/content/review/${review._id}/hide`)
      .set(as(admin))
      .send({ reason: 'Spam' });
    expect(reviewHidden.status).toBe(200);
    expect((await request(app).get(`/api/reviews/${review._id}`)).status).toBe(404);
    expect((await request(app).get(`/api/reviews/${review._id}`).set(as(player))).status).toBe(200);
    const inbox = await request(app).get(`/api/games/${game._id}/feedback`).set(as(dev));
    expect(inbox.body.total).toBe(0);

    const restored = await request(app)
      .post(`/api/admin/content/game/${game._id}/restore`)
      .set(as(admin));
    expect(restored.body.hidden).toBe(false);
    expect((await request(app).get(`/api/games/${game._id}`)).status).toBe(200);
  });

  it('records one open report per person and lets an admin resolve it', async () => {
    const filed = await request(app)
      .post('/api/reports')
      .set(as(player))
      .send({ targetType: 'game', targetId: game._id.toString(), reason: 'spam', details: 'Ad' });
    expect(filed.status).toBe(201);

    const again = await request(app)
      .post('/api/reports')
      .set(as(player))
      .send({ targetType: 'game', targetId: game._id.toString(), reason: 'spam' });
    expect(again.status).toBe(409);

    const own = await request(app)
      .post('/api/reports')
      .set(as(dev))
      .send({ targetType: 'game', targetId: game._id.toString(), reason: 'other' });
    expect(own.status).toBe(403);

    const queue = await request(app).get('/api/admin/reports?status=open').set(as(admin));
    expect(queue.body.total).toBe(1);
    expect(queue.body.items[0].target.preview).toBe(game.title);

    const resolved = await request(app)
      .patch(`/api/admin/reports/${filed.body.id}`)
      .set(as(admin))
      .send({ status: 'dismissed', note: 'Not spam' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe('dismissed');
  });

  it('suspends a player until a date and refuses to suspend an admin', async () => {
    const until = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const suspended = await request(app)
      .post(`/api/admin/users/${player._id}/suspend`)
      .set(as(admin))
      .send({ reason: 'Spam reviews', until });
    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe('suspended');

    const blocked = await request(app).get('/api/me').set(as(player));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('FORBIDDEN');

    const lifted = await request(app)
      .post(`/api/admin/users/${player._id}/unsuspend`)
      .set(as(admin));
    expect(lifted.body.status).toBe('active');
    expect((await request(app).get('/api/me').set(as(player))).status).toBe(200);

    const banned = await request(app)
      .post(`/api/admin/users/${player._id}/suspend`)
      .set(as(admin))
      .send({ reason: 'Ban', until: null });
    expect(banned.body.status).toBe('banned');

    const adminBan = await request(app)
      .post(`/api/admin/users/${admin._id}/suspend`)
      .set(as(admin))
      .send({ reason: 'Nope', until: null });
    expect(adminBan.status).toBe(403);
  });

  it('hides a genre from the public list without deleting the key', async () => {
    const current = await request(app).get('/api/admin/config').set(as(admin));
    const genres = current.body.genres.map((genre) =>
      genre.key === 'tactical' ? { ...genre, active: false } : genre,
    );
    const saved = await request(app).patch('/api/admin/config').set(as(admin)).send({ genres });
    expect(saved.status).toBe(200);

    const meta = await request(app).get('/api/meta');
    expect(meta.body.genres.map((genre) => genre.key)).not.toContain('tactical');

    const removed = genres.filter((genre) => genre.key !== 'tactical');
    const rejected = await request(app)
      .patch('/api/admin/config')
      .set(as(admin))
      .send({ genres: removed });
    expect(rejected.status).toBe(400);

    await request(app)
      .patch('/api/admin/config')
      .set(as(admin))
      .send({ genres: current.body.genres });
  });
});

describe('builds', () => {
  it('keeps a published download and marks a web build ready from the signed webhook', async () => {
    const dev = await createUser();
    const game = await createPublishedGame(dev, {
      delivery: { method: 'download', webUrl: null },
    });
    const upload = await Upload.create({
      owner: dev._id,
      purpose: 'download_build',
      fileName: 'tempest-demo-windows.zip',
      contentType: 'application/zip',
      size: 1200,
      key: 'uploads/tempest.zip',
      bucket: 'playloop-local-builds',
      status: 'uploaded',
      method: 'single',
      game: game._id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const added = await request(app)
      .post(`/api/games/${game._id}/builds`)
      .set(as(dev))
      .send({ uploadId: upload._id.toString(), target: 'windows' });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({
      target: 'windows',
      status: 'ready',
      fileName: upload.fileName,
    });

    const removed = await request(app)
      .delete(`/api/games/${game._id}/builds/${added.body.id}`)
      .set(as(dev));
    expect(removed.status).toBe(409);

    const web = await Build.create({
      game: game._id,
      owner: dev._id,
      target: 'web',
      status: 'processing',
      fileName: 'web.zip',
      size: 500,
      version: game.version,
      key: 'builds/web.zip',
      bucket: 'playloop-local-builds',
    });
    const body = JSON.stringify({ status: 'ready', entryPath: 'index.html' });
    const unsigned = await request(app)
      .post(`/api/internal/builds/${web._id}/status`)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(unsigned.status).toBe(401);

    const ready = await request(app)
      .post(`/api/internal/builds/${web._id}/status`)
      .set('Content-Type', 'application/json')
      .set('X-PlayLoop-Signature', sign(body))
      .send(body);
    expect(ready.status).toBe(204);

    const stored = await Build.findById(web._id);
    expect(stored.status).toBe('ready');
    expect(stored.playUrl).toContain('index.html');
    await settle();
    expect(await Notification.countDocuments({ user: dev._id, type: 'build_ready' })).toBe(1);

    const again = await request(app)
      .post(`/api/internal/builds/${web._id}/status`)
      .set('Content-Type', 'application/json')
      .set('X-PlayLoop-Signature', sign(body))
      .send(body);
    expect(again.status).toBe(204);
    await settle();
    expect(await Notification.countDocuments({ user: dev._id, type: 'build_ready' })).toBe(1);
  });

  it('rejects an upload that does not match the purpose', async () => {
    const dev = await createUser();
    const game = await createPublishedGame(dev);
    const res = await request(app).post('/api/uploads').set(as(dev)).send({
      purpose: 'game_media',
      fileName: 'notes.txt',
      contentType: 'text/plain',
      size: 100,
      gameId: game._id.toString(),
    });
    expect(res.status).toBe(400);
  });
});
