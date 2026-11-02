import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './ApiError.js';
import { currentRequestId } from './context.js';
import { logger } from './logger.js';

const MAX_AGE_MS = 60_000;

export function signInternal({ method, path, body, timestamp }) {
  return createHmac('sha256', process.env.INTERNAL_SERVICE_SECRET)
    .update(`${timestamp}\n${method}\n${path}\n${body}`)
    .digest('hex');
}

export function internalGuard(req, _res, next) {
  const timestamp = req.get('x-playloop-timestamp') ?? '';
  const provided = Buffer.from(req.get('x-playloop-signature') ?? '');
  const expected = Buffer.from(
    signInternal({
      method: req.method,
      path: req.originalUrl,
      body: req.rawBody ?? '',
      timestamp,
    }),
  );
  const fresh = Math.abs(Date.now() - Number(timestamp)) <= MAX_AGE_MS;
  if (!fresh || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw ApiError.unauthorized('Invalid signature');
  }
  next();
}

export function internalClient(urlEnvName, { timeoutMs = 3000 } = {}) {
  async function call(method, path, body) {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const timestamp = String(Date.now());
    const requestId = currentRequestId();
    try {
      const res = await fetch(`${process.env[urlEnvName]}${path}`, {
        method,
        body: payload || undefined,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'X-PlayLoop-Timestamp': timestamp,
          'X-PlayLoop-Signature': signInternal({ method, path, body: payload, timestamp }),
          ...(payload && { 'Content-Type': 'application/json' }),
          ...(requestId && { 'X-Request-Id': requestId }),
        },
      });
      if (res.status === 204) return null;
      if (res.status >= 500) throw new Error(`Internal call returned ${res.status}`);
      const json = await res.json();
      if (!res.ok) throw new ApiError(res.status, json.code, json.message, json.details);
      return json;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.warn({ err, method, path }, 'Internal call failed');
      throw ApiError.unavailable();
    }
  }

  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
    put: (path, body) => call('PUT', path, body),
  };
}

const identity = internalClient('IDENTITY_URL');

export async function loadRemoteAccount(id) {
  try {
    return await identity.get(`/internal/accounts/${id}/access`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}
