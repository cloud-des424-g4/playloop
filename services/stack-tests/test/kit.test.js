import { describe, expect, it } from 'vitest';
import { Router } from 'express';
import request from 'supertest';
import { ApiError, accountBlockMessage, createServiceApp } from '@playloop/kit';

describe('createServiceApp', () => {
  it('returns SERVICE_UNAVAILABLE as JSON with response validation on', async () => {
    const routes = Router();
    routes.get('/games', () => {
      throw ApiError.unavailable();
    });
    const res = await request(createServiceApp({ routes })).get('/api/games');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'This service is unavailable, please try again',
    });
  });

  it('reads the proxy hop count when the app is created', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    expect(createServiceApp({ routes: Router() }).get('trust proxy')).toBe(2);
    delete process.env.TRUST_PROXY_HOPS;
    expect(createServiceApp({ routes: Router() }).get('trust proxy')).toBe(1);
  });

  it('reports its own database on /api/health', async () => {
    const res = await request(createServiceApp({ routes: Router() })).get('/api/health');
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });
});

describe('accountBlockMessage', () => {
  const future = new Date(Date.now() + 86_400_000);

  it('blocks a suspension whose end date arrived as JSON', () => {
    const account = { status: 'suspended', suspension: { until: future.toISOString() } };
    expect(accountBlockMessage(account)).toBe(
      `Your account is suspended until ${future.toISOString().slice(0, 10)}`,
    );
  });

  it('stops blocking once the suspension has ended', () => {
    const until = new Date(Date.now() - 1000).toISOString();
    expect(accountBlockMessage({ status: 'suspended', suspension: { until } })).toBeNull();
  });
});
