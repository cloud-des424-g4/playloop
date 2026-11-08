import { createHmac } from 'node:crypto';
import { getWebhookSecret } from './webhook-secret.js';

export async function handler() {
  const signature = createHmac('sha256', await getWebhookSecret())
    .update('')
    .digest('hex');
  const res = await fetch(`${process.env.API_URL}/api/internal/badges/monthly`, {
    method: 'POST',
    headers: { 'X-PlayLoop-Signature': signature },
  });
  if (!res.ok) throw new Error(`Monthly badge call failed with ${res.status}`);
}
