import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from './stack.js';
import { Game } from '../../community/src/modules/games/game.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });

let dev;
let player;
let game;

beforeEach(async () => {
  dev = await createUser();
  player = await createUser();
  game = await createPublishedGame(dev);
});

const spin = (body = {}, user = player) =>
  request(app).post('/api/roulette/spin').set(as(user)).send(body);

describe('spin', () => {
  it('needs login', async () => {
    expect((await request(app).post('/api/roulette/spin').send({})).status).toBe(401);
  });

  it('lands on a matching game with its missions', async () => {
    const res = await spin({ platform: 'web', genres: ['survival'], maxMinutes: 15 });
    expect(res.status).toBe(200);
    expect(res.body.game).toMatchObject({
      id: game.id,
      missionCount: 2,
      estimatedMinutes: 15,
      deliveryMethod: 'web',
    });
    expect(res.body.spinToken).toEqual(expect.any(String));
  });

  it('never returns your own game', async () => {
    const res = await spin({}, dev);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_MATCH');
  });

  it('respects platform, genre, build stage, time and skipped games', async () => {
    for (const body of [
      { platform: 'pc' },
      { genres: ['horror'] },
      { buildStage: 'beta' },
      { exclude: [game.id] },
    ]) {
      expect((await spin(body)).body.code).toBe('NO_MATCH');
    }
    await Game.updateOne(
      { _id: game._id },
      { 'form.playtest.missions': [{ id: 'm1', title: 'Long one', minutes: 45 }] },
    );
    expect((await spin({ maxMinutes: 30 })).body.code).toBe('NO_MATCH');
    expect((await spin({ maxMinutes: 60 })).status).toBe(200);
  });

  it('skips games without missions, drafts and deleted games', async () => {
    await Game.updateOne({ _id: game._id }, { 'form.playtest.missions': [] });
    await createPublishedGame(dev, { status: 'draft' });
    await createPublishedGame(dev, { deletedAt: new Date() });
    expect((await spin()).body.code).toBe('NO_MATCH');
  });

  it('skips games you already reviewed at the current version', async () => {
    await createSubmittedReview(game, player);
    expect((await spin()).body.code).toBe('NO_MATCH');
    await Game.updateOne({ _id: game._id }, { version: '0.2' });
    expect((await spin()).status).toBe(200);
  });
});

describe('accept', () => {
  it('starts a review with origin roulette', async () => {
    const { body } = await spin();
    const res = await request(app)
      .post('/api/roulette/accept')
      .set(as(player))
      .send({ spinToken: body.spinToken });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ origin: 'roulette', status: 'in_progress' });
    expect(res.body.game.id).toBe(game.id);
  });

  it('rejects tokens that are forged or belong to someone else', async () => {
    const { body } = await spin();
    const other = await createUser();
    const forged = jwt.sign(
      { sub: player.id, gameId: game.id, purpose: 'roulette' },
      'wrong-secret',
    );
    for (const [user, spinToken] of [
      [other, body.spinToken],
      [player, forged],
    ]) {
      const res = await request(app).post('/api/roulette/accept').set(as(user)).send({ spinToken });
      expect(res.status).toBe(400);
    }
  });
});
