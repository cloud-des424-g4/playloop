import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp, withServiceDown } from './stack.js';
import { createApp as createIdentity } from '../../identity/src/app.js';
import { User } from '../../identity/src/modules/accounts/user.model.js';
import { ModerationAction } from '../../community/src/modules/admin/moderation.model.js';
import { Member } from '../../community/src/modules/users/member.model.js';
import { ensureMember } from '../../community/src/modules/users/user.service.js';
import { authCookie, createPublishedGame, createUser } from './helpers.js';

const app = createApp();
const as = (user) => ({ Cookie: authCookie(user) });
const account = {
  username: 'kai_storm',
  email: 'kai@example.com',
  password: 'correct-horse-9',
  acceptTerms: true,
};
const register = () => request(app).post('/api/auth/register').send(account);
const login = () =>
  request(app).post('/api/auth/login').send({ email: account.email, password: account.password });

describe('registration and login', () => {
  it('can retry registration after a 503', async () => {
    const failed = await withServiceDown('community', register);
    expect(failed.status).toBe(503);
    expect(await User.countDocuments()).toBe(0);

    const retried = await register();
    expect(retried.status).toBe(201);
    expect(await User.countDocuments()).toBe(1);
    expect(await Member.countDocuments()).toBe(1);
  });

  it('can retry registration after Community saved the Member but its reply was lost', async () => {
    await Member.init();
    await Member.create({ username: account.username, email: account.email });
    const retried = await register();
    expect(retried.status).toBe(201);
    expect(await Member.countDocuments()).toBe(1);
    expect((await Member.findOne()).id).toBe(retried.body.id);
  });

  it('refuses a username whose old Member still owns content', async () => {
    await Member.init();
    const owner = await createUser({ username: account.username, email: account.email });
    await createPublishedGame(owner);
    await User.deleteOne({ _id: owner._id });

    const res = await register();
    expect(res.status).toBe(409);
    expect(await User.countDocuments()).toBe(0);
    expect(await Member.exists({ _id: owner._id })).toBeTruthy();
    expect((await request(app).get('/api/games')).status).toBe(200);
  });

  it("doesn't let a late call delete a newer Member", async () => {
    await Member.init();
    const { body } = await register();
    const late = mongoose.Types.ObjectId.createFromTime(Math.floor(Date.now() / 1000) - 60);
    await expect(ensureMember(late.toString(), account)).rejects.toMatchObject({ status: 409 });
    expect(await Member.exists({ _id: body.id })).toBeTruthy();
  });

  it('repairs a missing Member at login', async () => {
    const { body } = await register();
    await Member.deleteOne({ _id: body.id });
    const res = await login();
    expect(res.status).toBe(200);
    expect(await Member.exists({ _id: body.id })).toBeTruthy();
  });

  it('answers 401 for a session with no Member', async () => {
    const user = await createUser();
    await Member.deleteOne({ _id: user._id });
    const res = await request(app).get('/api/me').set(as(user));
    expect(res.status).toBe(401);
  });

  it('treats a session with no Member as a guest on public routes', async () => {
    const user = await createUser();
    await Member.deleteOne({ _id: user._id });
    const res = await request(app).get('/api/games').set(as(user));
    expect(res.status).toBe(200);
  });
});

describe('password changes', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('limits each person, not everyone together', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const [first, second] = await Promise.all([createUser(), createUser()]);
    const change = (user) =>
      request(app)
        .put('/api/auth/password')
        .set(as(user))
        .send({ currentPassword: 'wrong-password-1', newPassword: 'another-password-2' });

    for (let attempt = 0; attempt < 10; attempt += 1) await change(first);
    expect((await change(first)).status).toBe(429);
    expect((await change(second)).status).toBe(400);
  });
});

describe('admin actions', () => {
  let admin;
  let player;

  beforeEach(async () => {
    admin = await createUser({ role: 'admin' });
    player = await createUser();
  });

  const ban = () =>
    request(app)
      .post(`/api/admin/users/${player._id}/suspend`)
      .set(as(admin))
      .send({ reason: 'Cheating', until: null });

  it('leaves everything unchanged when Identity is down during a ban', async () => {
    const res = await withServiceDown('identity', ban);
    expect(res.status).toBe(503);
    expect((await Member.findById(player._id)).status).toBe('active');
    expect(await ModerationAction.countDocuments()).toBe(0);
  });

  it('applies a ban to every service', async () => {
    expect((await ban()).status).toBe(200);
    const responses = await Promise.all([
      request(app).get('/api/me').set(as(player)),
      request(app).get('/api/me/notifications').set(as(player)),
      request(app).post('/api/uploads').set(as(player)).send({
        purpose: 'avatar',
        fileName: 'me.png',
        contentType: 'image/png',
        size: 1024,
      }),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Your account has been banned');
    }
  });

  it('keeps Identity in step when a ban is lifted and a role changes', async () => {
    await ban();
    await request(app).post(`/api/admin/users/${player._id}/unsuspend`).set(as(admin));
    await request(app)
      .put(`/api/admin/users/${player._id}/role`)
      .set(as(admin))
      .send({ role: 'admin' });
    const stored = await User.findById(player._id);
    expect(stored).toMatchObject({ status: 'active', role: 'admin' });
    expect(stored.toObject().suspension).toBeUndefined();
  });

  it('lifts a suspension by date on every service', async () => {
    const lapsed = await createUser({
      status: 'suspended',
      suspension: { reason: 'Spam', until: new Date(Date.now() - 1000), at: new Date() },
    });
    const res = await request(app).get('/api/me/notifications').set(as(lapsed));
    expect(res.status).toBe(200);
  });

  it('rejects an unsigned call to the access route', async () => {
    const res = await request(createIdentity()).get(`/internal/accounts/${player._id}/access`);
    expect(res.status).toBe(401);
  });
});
