import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, withServiceDown } from './stack.js';
import { Game } from '../../community/src/modules/games/game.model.js';
import { Upload } from '../../media/src/modules/uploads/upload.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

const finished = (owner, overrides = {}) =>
  Upload.create({
    owner: owner._id,
    purpose: 'avatar',
    fileName: 'me.png',
    contentType: 'image/png',
    size: 1024,
    key: `uploads/${owner._id}/me.png`,
    bucket: 'media',
    method: 'single',
    status: 'uploaded',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  });

describe('Media', () => {
  let dev;
  let reviewer;
  let game;

  beforeEach(async () => {
    dev = await createUser();
    reviewer = await createUser();
    game = await createPublishedGame(dev);
  });

  it("rejects an upload for someone else's game through Media", async () => {
    const res = await request(app).post('/api/uploads').set(as(reviewer)).send({
      purpose: 'game_media',
      fileName: 'shot.png',
      contentType: 'image/png',
      size: 1024,
      gameId: game.id,
    });
    expect(res.status).toBe(403);
  });

  it('rejects a proof upload for a submitted review', async () => {
    const review = await createSubmittedReview(game, reviewer);
    const res = await request(app).post('/api/uploads').set(as(reviewer)).send({
      purpose: 'proof_screenshot',
      fileName: 'proof.png',
      contentType: 'image/png',
      size: 1024,
      reviewId: review.id,
    });
    expect(res.status).toBe(409);
  });

  it('uses a finished upload as an avatar', async () => {
    const upload = await finished(dev);
    const res = await request(app)
      .patch('/api/me')
      .set(as(dev))
      .send({ avatarUploadId: upload.id });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toContain(upload.key);
  });

  it("refuses an upload that isn't finished", async () => {
    const upload = await finished(dev, { status: 'pending' });
    const res = await request(app)
      .patch('/api/me')
      .set(as(dev))
      .send({ avatarUploadId: upload.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Upload is not ready');
  });

  it('leaves the game unchanged when Media is down', async () => {
    const upload = await finished(dev, { purpose: 'game_media', game: game._id });
    const before = (await Game.findById(game._id)).toObject().media;
    const res = await withServiceDown('media', () =>
      request(app)
        .patch(`/api/games/${game._id}`)
        .set(as(dev))
        .send({ mediaIds: [upload.id] }),
    );
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
    expect((await Game.findById(game._id)).toObject().media).toEqual(before);
  });

  it('keeps existing media with Media down', async () => {
    const withMedia = await createPublishedGame(dev, {
      media: [{ type: 'image', key: 'games/cover.png' }],
    });
    const res = await withServiceDown('media', () =>
      request(app)
        .patch(`/api/games/${withMedia._id}`)
        .set(as(dev))
        .send({ mediaIds: [withMedia.media[0].id] }),
    );
    expect(res.status).toBe(200);
  });

  it('serves upload limits with Media down', async () => {
    const res = await withServiceDown('media', () => request(app).get('/api/meta'));
    expect(res.status).toBe(200);
    expect(res.body.uploadLimits.avatar).toBeDefined();
  });
});
