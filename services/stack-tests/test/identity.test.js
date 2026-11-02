import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, withServiceDown } from './stack.js';
import { createApp as createIdentity } from '../../identity/src/app.js';
import { User } from '../../identity/src/modules/accounts/user.model.js';
import { ModerationAction } from '../../community/src/modules/admin/moderation.model.js';
import { Member } from '../../community/src/modules/users/member.model.js';
import { authCookie, createUser } from './helpers.js';

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
