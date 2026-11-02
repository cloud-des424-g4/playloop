import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { User } from '../../community/src/modules/users/user.model.js';
import { requestPasswordReset } from '../../community/src/modules/auth/auth.service.js';

const app = createApp();

const account = {
  username: 'enolaholmes',
  email: 'enola@example.com',
  password: 'storm-chaser-42',
  acceptTerms: true,
};

describe('accounts', () => {
  it('registers, returns the private profile, and starts a session', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(account);

    expect(res.status).toBe(201);
    expect(res.headers['set-cookie'][0]).toMatch(/playloop_token=.*; HttpOnly/);
    expect(res.body).toMatchObject({
      username: 'enolaholmes',
      email: 'enola@example.com',
      role: 'user',
      displayName: 'enolaholmes',
      reputation: { points: 0, level: 1, title: 'Rookie' },
      stats: { reviewsWritten: 0, gamesPublished: 0, helpfulVotes: 0 },
    });
    expect(res.body.passwordHash).toBeUndefined();

    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('enola@example.com');

    const stored = await User.findOne({ email: account.email }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe(account.password);
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects a duplicate email or username and a reserved username', async () => {
    await request(app).post('/api/auth/register').send(account);

    const email = await request(app)
      .post('/api/auth/register')
      .send({ ...account, username: 'someoneelse' });
    expect(email.status).toBe(409);

    const username = await request(app)
      .post('/api/auth/register')
      .send({ ...account, email: 'other@example.com' });
    expect(username.status).toBe(409);

    const reserved = await request(app)
      .post('/api/auth/register')
      .send({ ...account, username: 'admin', email: 'admin@example.com' });
    expect(reserved.status).toBe(400);
    expect(reserved.body.details[0].path).toBe('/body/username');
  });

  it('reports whether a username is free', async () => {
    await request(app).post('/api/auth/register').send(account);

    const taken = await request(app)
      .get('/api/auth/username-available')
      .query({ username: 'EnolaHolmes' });
    expect(taken.body).toEqual({ username: 'EnolaHolmes', available: false, reason: 'taken' });

    const reserved = await request(app)
      .get('/api/auth/username-available')
      .query({ username: 'playloop' });
    expect(reserved.body.reason).toBe('reserved');

    const invalid = await request(app)
      .get('/api/auth/username-available')
      .query({ username: 'no' });
    expect(invalid.body.reason).toBe('invalid');

    const free = await request(app)
      .get('/api/auth/username-available')
      .query({ username: 'kai_dev' });
    expect(free.body).toEqual({ username: 'kai_dev', available: true });
  });

  it('logs in with email or username and rejects a wrong password the same way', async () => {
    await request(app).post('/api/auth/register').send(account);

    const byEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'Enola@Example.com', password: account.password });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.username).toBe('enolaholmes');

    const byUsername = await request(app)
      .post('/api/auth/login')
      .send({ email: 'EnolaHolmes', password: account.password });
    expect(byUsername.status).toBe(200);

    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: account.password });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Email or password is incorrect',
    });
  });

  it('refuses login for a banned account', async () => {
    await request(app).post('/api/auth/register').send(account);
    await User.updateOne({ email: account.email }, { status: 'banned' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Your account has been banned');
  });

  it('logs out and ends the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(account);
    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect((await agent.get('/api/me')).status).toBe(401);
  });

  it('resets a password with a one-time token and ignores unknown emails', async () => {
    await request(app).post('/api/auth/register').send(account);
    const missing = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(missing.status).toBe(202);

    const token = await requestPasswordReset(account.email);
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'new-password-99' });
    expect(reset.status).toBe(204);

    const again = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'another-password' });
    expect(again.status).toBe(400);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: account.username, password: 'new-password-99' });
    expect(login.status).toBe(200);
  });

  it('changes the password when the current one matches', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(account);

    const wrong = await agent
      .put('/api/auth/password')
      .send({ currentPassword: 'nope-nope', newPassword: 'changed-pass-1' });
    expect(wrong.status).toBe(400);

    const changed = await agent
      .put('/api/auth/password')
      .send({ currentPassword: account.password, newPassword: 'changed-pass-1' });
    expect(changed.status).toBe(204);

    const old = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password });
    expect(old.status).toBe(401);
    const next = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'changed-pass-1' });
    expect(next.status).toBe(200);
  });
});
