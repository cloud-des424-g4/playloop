import { createHmac } from 'node:crypto';

export async function handler() {
  const signature = createHmac('sha256', process.env.INTERNAL_WEBHOOK_SECRET)
    .update('')
    .digest('hex');
  const res = await fetch(`${process.env.API_URL}/api/internal/badges/monthly`, {
    method: 'POST',
    headers: { 'X-PlayLoop-Signature': signature },
  });
  if (!res.ok) throw new Error(`Monthly badge call failed with ${res.status}`);
}
