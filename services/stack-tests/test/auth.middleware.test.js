import { describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { levelFor } from '@playloop/shared';
import { optionalAuth, requireAuth, SESSION_COOKIE } from '../../community/src/middleware/auth.js';
import { errorHandler } from '@playloop/kit';
import { authCookie, createUser } from './helpers.js';

const app = express();
app.use(cookieParser());
app.get('/required', requireAuth, (req, res) => res.json(req.user));
app.get('/optional', optionalAuth, (req, res) => res.json({ user: req.user }));
app.use(errorHandler);

describe('requireAuth', () => {
  it('rejects requests without a session', async () => {
    const res = await request(app).get('/required');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects tampered tokens', async () => {
    const user = await createUser();
    const forged = jwt.sign({ sub: user._id.toString() }, 'wrong-secret');
    const res = await request(app).get('/required').set('Cookie', `${SESSION_COOKIE}=${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects tokens for deleted users', async () => {
    const user = await createUser();
    const cookie = authCookie(user);
    await user.deleteOne();
    const res = await request(app).get('/required').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('sets req.user with the role from the database', async () => {
    const user = await createUser({ role: 'admin' });
    const res = await request(app).get('/required').set('Cookie', authCookie(user));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user._id.toString(), role: 'admin' });
  });

  it('blocks banned and currently suspended users', async () => {
    const banned = await createUser({ status: 'banned' });
    const suspended = await createUser({
      status: 'suspended',
      suspension: { reason: 'spam', until: new Date(Date.now() + 86_400_000) },
    });
    for (const user of [banned, suspended]) {
      const res = await request(app).get('/required').set('Cookie', authCookie(user));
      expect(res.status).toBe(403);
    }
  });

  it('lets users in once a suspension has ended', async () => {
    const user = await createUser({
      status: 'suspended',
      suspension: { reason: 'spam', until: new Date(Date.now() - 1000) },
    });
    const res = await request(app).get('/required').set('Cookie', authCookie(user));
    expect(res.status).toBe(200);
  });
});

describe('optionalAuth', () => {
  it('sets req.user to null when logged out or blocked', async () => {
    const banned = await createUser({ status: 'banned' });
    expect((await request(app).get('/optional')).body.user).toBeNull();
    const res = await request(app).get('/optional').set('Cookie', authCookie(banned));
    expect(res.body.user).toBeNull();
  });
});

describe('levelFor', () => {
  it('maps points to the level and the next threshold', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Rookie', nextLevelMinPoints: 100 });
    expect(levelFor(1240)).toMatchObject({ level: 4, title: 'Critic', nextLevelMinPoints: 1500 });
    expect(levelFor(99999)).toMatchObject({ level: 8, nextLevelMinPoints: null });
  });
});
