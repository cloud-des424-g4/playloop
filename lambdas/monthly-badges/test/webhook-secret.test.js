import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { getWebhookSecret as monthlySecret } from '../src/webhook-secret.js';
import { getWebhookSecret as buildSecret } from '../../build-unzip/src/webhook-secret.js';

afterEach(() => mock.restoreAll());

for (const [name, getSecret] of [
  ['monthly-badges', monthlySecret],
  ['build-unzip', buildSecret],
]) {
  test(`${name}: reads AWSCURRENT on each invocation so rotations are observed`, async () => {
    process.env.INTERNAL_WEBHOOK_SECRET_ARN = 'test-secret-id';
    let current = randomBytes(32).toString('hex');
    const send = mock.method(SecretsManagerClient.prototype, 'send', async (command) => {
      assert.ok(command instanceof GetSecretValueCommand);
      assert.deepEqual(command.input, { SecretId: 'test-secret-id', VersionStage: 'AWSCURRENT' });
      return { SecretString: current };
    });
    assert.ok((await getSecret()) === current);
    current = randomBytes(32).toString('hex');
    assert.ok((await getSecret()) === current);
    assert.equal(send.mock.callCount(), 2);
  });

  test(`${name}: rejects missing configuration without calling AWS`, async () => {
    delete process.env.INTERNAL_WEBHOOK_SECRET_ARN;
    const send = mock.method(SecretsManagerClient.prototype, 'send', async () => {
      throw new Error('Unexpected AWS call');
    });
    await assert.rejects(getSecret(), /INTERNAL_WEBHOOK_SECRET_ARN is required/);
    assert.equal(send.mock.callCount(), 0);
  });

  test(`${name}: rejects unusable values and sanitizes retrieval failures`, async () => {
    process.env.INTERNAL_WEBHOOK_SECRET_ARN = 'test-secret-id';
    for (const response of [{}, { SecretBinary: new Uint8Array(32) }, { SecretString: '' }]) {
      mock.method(SecretsManagerClient.prototype, 'send', async () => response);
      await assert.rejects(getSecret(), { message: 'Could not retrieve the webhook secret' });
      mock.restoreAll();
    }
    mock.method(SecretsManagerClient.prototype, 'send', async () => {
      throw new Error(randomBytes(32).toString('hex'));
    });
    await assert.rejects(getSecret(), { message: 'Could not retrieve the webhook secret' });
  });
}
