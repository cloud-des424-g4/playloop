import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Router } from 'express';
import { ApiError, createServiceApp, internalClient, signInternal } from '@playloop/kit';

const details = [{ path: '/body', message: 'nope' }];
const internalRoutes = Router();
internalRoutes.post('/echo', (req, res) => res.json(req.body));
internalRoutes.get('/empty', (_req, res) => res.status(204).end());
internalRoutes.get('/missing', () => {
  throw ApiError.notFound('Game not found');
});
internalRoutes.get('/invalid', () => {
  throw ApiError.validation('Some fields are invalid', details);
});
internalRoutes.get('/broken', () => {
  throw new Error('boom');
});
internalRoutes.get('/hang', () => {});
internalRoutes.get('/request-id', (req, res) => res.json({ id: req.get('x-request-id') }));
internalRoutes.get('/relay', async (_req, res) => {
  res.json(await client.get('/internal/request-id'));
});

const client = internalClient('PEER_URL');
let server;

function signedFetch(path, { method = 'GET', body = '', timestamp = String(Date.now()) } = {}) {
  return {
    timestamp,
    send: (sent, signature, headers = {}) =>
      fetch(`${process.env.PEER_URL}${path}`, {
        method,
        body: sent || undefined,
        headers: {
          'Content-Type': 'application/json',
          'X-PlayLoop-Timestamp': timestamp,
          'X-PlayLoop-Signature': signature ?? signInternal({ method, path, body, timestamp }),
          ...headers,
        },
      }),
  };
}

beforeAll(async () => {
  server = createServiceApp({ routes: Router(), internalRoutes }).listen(0);
  await once(server, 'listening');
  process.env.PEER_URL = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('internal signatures', () => {
  it('accepts a signed call', async () => {
    expect(await client.post('/internal/echo', { ok: true })).toEqual({ ok: true });
  });

  it('returns null for a 204', async () => {
    expect(await client.get('/internal/empty')).toBeNull();
  });

  it('rejects a changed body', async () => {
    const call = signedFetch('/internal/echo', { method: 'POST', body: '{"a":1}' });
    expect((await call.send('{"a":2}')).status).toBe(401);
  });

  it('rejects a signature from another secret', async () => {
    const call = signedFetch('/internal/empty');
    const forged = createHmac('sha256', 'other-secret')
      .update(`${call.timestamp}\nGET\n/internal/empty\n`)
      .digest('hex');
    expect((await call.send('', forged)).status).toBe(401);
  });

  it('rejects a signature made for another path', async () => {
    const call = signedFetch('/internal/empty');
    const signature = signInternal({
      method: 'GET',
      path: '/internal/missing',
      body: '',
      timestamp: call.timestamp,
    });
    expect((await call.send('', signature)).status).toBe(401);
  });

  it('rejects a timestamp 61 seconds old', async () => {
    const call = signedFetch('/internal/empty', { timestamp: String(Date.now() - 61_000) });
    expect((await call.send('')).status).toBe(401);
  });

  it('rejects a call with no signature headers', async () => {
    const res = await fetch(`${process.env.PEER_URL}/internal/empty`);
    expect(res.status).toBe(401);
  });
});

describe('internal client errors', () => {
  it('passes a 404 through unchanged', async () => {
    await expect(client.get('/internal/missing')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Game not found',
    });
  });

  it('passes a 400 with details through unchanged', async () => {
    const err = await client.get('/internal/invalid').catch((error) => error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.details).toEqual(details);
  });

  it('turns a 500 into SERVICE_UNAVAILABLE', async () => {
    await expect(client.get('/internal/broken')).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('turns a closed port into SERVICE_UNAVAILABLE', async () => {
    process.env.CLOSED_URL = 'http://127.0.0.1:9';
    await expect(internalClient('CLOSED_URL').get('/internal/x')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('turns a timeout into SERVICE_UNAVAILABLE', async () => {
    const slow = internalClient('PEER_URL', { timeoutMs: 50 });
    await expect(slow.get('/internal/hang')).rejects.toMatchObject({ status: 503 });
  });

  it('forwards the request id', async () => {
    const call = signedFetch('/internal/relay');
    const res = await call.send('', undefined, { 'X-Request-Id': 'abc' });
    expect((await res.json()).id).toBe('abc');
  });
});
