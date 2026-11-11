import { describe, expect, it } from 'vitest';
import { api, ApiError } from '../lib/api.js';
import { MAX_LOGIN_FAILURES } from './db.js';

// The mock handlers against the contract in docs/api/paths/auth.yaml.

const valid = {
  username: 'new_player',
  email: 'new@example.com',
  password: 'a-good-password',
  acceptTerms: true,
};

async function failure(promise) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error;
  }
  throw new Error('Expected the request to fail');
}

describe('GET /auth/username-available', () => {
  it('answers available, taken, reserved and invalid', async () => {
    const check = (name) => api.get(`/auth/username-available?username=${name}`);

    expect(await check('fresh_name')).toEqual({ username: 'fresh_name', available: true });
    expect(await check('ENOLAHOLMES')).toMatchObject({ available: false, reason: 'taken' });
    expect(await check('admin')).toMatchObject({ available: false, reason: 'reserved' });
    expect(await check('no-dashes')).toMatchObject({ available: false, reason: 'invalid' });
  });

  it('rejects a missing username with VALIDATION_ERROR', async () => {
    const error = await failure(api.get('/auth/username-available'));
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });
});

describe('POST /auth/register', () => {
  it('creates the account and logs it in', async () => {
    const me = await api.post('/auth/register', valid);

    expect(me).toMatchObject({ username: 'new_player', email: 'new@example.com', role: 'user' });
    expect(me.id).toMatch(/^[a-f0-9]{24}$/);
    expect(me).not.toHaveProperty('password');
    expect(await api.get('/me')).toMatchObject({ username: 'new_player' });
  });

  it('answers 400 with a path per problem', async () => {
    const error = await failure(
      api.post('/auth/register', {
        ...valid,
        username: 'a',
        password: 'short',
        acceptTerms: false,
      }),
    );

    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(error.details.map((detail) => detail.path)).toEqual([
      '/body/username',
      '/body/password',
      '/body/acceptTerms',
    ]);
  });

  it('refuses unknown and missing properties', async () => {
    const extra = await failure(api.post('/auth/register', { ...valid, admin: true }));
    expect(extra.details).toContainEqual({
      path: '/body',
      message: 'must NOT have additional properties',
    });

    const missing = { ...valid };
    delete missing.email;
    const error = await failure(api.post('/auth/register', missing));
    expect(error.details[0].message).toBe("must have required property 'email'");
  });

  it('answers 409 for a taken username or email', async () => {
    const username = await failure(
      api.post('/auth/register', { ...valid, username: 'enolaholmes' }),
    );
    expect(username).toMatchObject({ status: 409, code: 'CONFLICT' });

    const email = await failure(
      api.post('/auth/register', { ...valid, email: 'ENOLA@example.com' }),
    );
    expect(email).toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});

describe('POST /auth/login', () => {
  it('logs in with email and password', async () => {
    const me = await api.post('/auth/login', {
      email: 'enola@example.com',
      password: 'storm-chaser-42',
    });
    expect(me.username).toBe('enolaholmes');
    expect(await api.get('/me')).toMatchObject({ username: 'enolaholmes' });
  });

  it('answers 401 with the same message for an unknown email and a wrong password', async () => {
    const unknown = await failure(
      api.post('/auth/login', { email: 'nobody@example.com', password: 'whatever-1' }),
    );
    const wrong = await failure(
      api.post('/auth/login', { email: 'enola@example.com', password: 'whatever-1' }),
    );

    expect(unknown).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(unknown.message).toBe('Email or password is incorrect');
    expect(wrong.message).toBe(unknown.message);
  });

  it('answers 403 with the reason for suspended and banned users', async () => {
    const suspended = await failure(
      api.post('/auth/login', { email: 'suspended@example.com', password: 'suspended-pass1' }),
    );
    const banned = await failure(
      api.post('/auth/login', { email: 'banned@example.com', password: 'banned-pass-1' }),
    );

    expect(suspended).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(suspended.message).toContain('Repeated spam reports');
    expect(banned.message).toContain('Harassment of other users');
  });

  it('answers 429 after repeated failures for one email, even with the right password', async () => {
    const wrong = { email: 'enola@example.com', password: 'not-the-password' };
    for (let attempt = 0; attempt < MAX_LOGIN_FAILURES; attempt += 1) {
      expect(await failure(api.post('/auth/login', wrong))).toMatchObject({ status: 401 });
    }

    const limited = await failure(
      api.post('/auth/login', { email: 'enola@example.com', password: 'storm-chaser-42' }),
    );
    expect(limited).toMatchObject({ status: 429, code: 'RATE_LIMITED' });

    // The limit is per email: another account is not affected.
    const other = await api.post('/auth/register', valid);
    expect(other.username).toBe('new_player');
  });

  it('answers 400 for a malformed email', async () => {
    const error = await failure(api.post('/auth/login', { email: 'nope', password: 'x' }));
    expect(error.details).toContainEqual({
      path: '/body/email',
      message: 'must match format "email"',
    });
  });
});

describe('GET /me and POST /auth/logout', () => {
  it('answers 401 when logged out and after logging out', async () => {
    expect(await failure(api.get('/me'))).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });

    await api.post('/auth/login', { email: 'enola@example.com', password: 'storm-chaser-42' });
    expect(await api.post('/auth/logout')).toBeNull();
    expect(await failure(api.get('/me'))).toMatchObject({ status: 401 });
  });
});
