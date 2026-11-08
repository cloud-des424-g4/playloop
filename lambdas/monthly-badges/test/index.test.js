import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { handler } from '../src/index.js';

const SECRET = randomBytes(32).toString('hex');

beforeEach(() => {
  process.env.INTERNAL_WEBHOOK_SECRET_ARN = 'test-secret-id';
  mock.method(SecretsManagerClient.prototype, 'send', async () => ({ SecretString: SECRET }));
});
afterEach(() => mock.restoreAll());

async function runAgainstApi(status) {
  const calls = [];
  const api = createServer((req, res) => {
    calls.push({
      method: req.method,
      url: req.url,
      signature: req.headers['x-playloop-signature'],
    });
    res.writeHead(status).end();
  });
  await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
  process.env.API_URL = `http://127.0.0.1:${api.address().port}`;
  try {
    await handler();
    return calls;
  } finally {
    await new Promise((resolve) => api.close(resolve));
  }
}

test('posts a signed request to the monthly badge endpoint', async () => {
  assert.deepEqual(await runAgainstApi(204), [
    {
      method: 'POST',
      url: '/api/internal/badges/monthly',
      signature: createHmac('sha256', SECRET).digest('hex'),
    },
  ]);
});

test('fails when the API refuses, so Lambda retries', async () => {
  await assert.rejects(runAgainstApi(500), /500/);
});
