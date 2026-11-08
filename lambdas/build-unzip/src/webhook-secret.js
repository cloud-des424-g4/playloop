import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const secrets = new SecretsManagerClient({});

export async function getWebhookSecret() {
  const SecretId = process.env.INTERNAL_WEBHOOK_SECRET_ARN;
  if (!SecretId) throw new Error('INTERNAL_WEBHOOK_SECRET_ARN is required');
  try {
    const { SecretString } = await secrets.send(
      new GetSecretValueCommand({ SecretId, VersionStage: 'AWSCURRENT' }),
    );
    if (typeof SecretString !== 'string' || SecretString.length < 32) {
      throw new Error('Invalid webhook secret');
    }
    return SecretString;
  } catch {
    // Never propagate service responses or secret contents into Lambda logs.
    throw new Error('Could not retrieve the webhook secret');
  }
}
