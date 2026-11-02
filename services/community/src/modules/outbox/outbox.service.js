import { internalClient, logger } from '@playloop/kit';
import { Outbox } from './outbox.model.js';

const notifications = internalClient('NOTIFICATIONS_URL');
const idOf = (value) => (value ? String(value._id ?? value) : undefined);

let timer;
let flushing = null;

export async function notify(input, session) {
  const { type, message, link } = input;
  const [row] = await Outbox.create(
    [
      {
        payload: {
          user: idOf(input.user),
          type,
          message,
          link,
          actor: idOf(input.actor),
          game: idOf(input.game),
          reviewId: idOf(input.reviewId),
        },
      },
    ],
    { session },
  );
  return row;
}

export const retryDelayMs = (attempts) => Math.min(2 ** attempts, 300) * 1000;

export async function flushOutbox({ limit = 50, now = new Date() } = {}) {
  const rows = await Outbox.find({ nextAttemptAt: { $lte: now } })
    .sort({ createdAt: 1 })
    .limit(limit);
  const result = { sent: 0, failed: 0 };
  for (const row of rows) {
    try {
      await notifications.post('/internal/notifications', {
        id: row._id,
        createdAt: row.createdAt,
        ...row.payload,
      });
      await row.deleteOne();
      result.sent += 1;
    } catch (err) {
      row.attempts += 1;
      row.nextAttemptAt = new Date(now.getTime() + retryDelayMs(row.attempts));
      await row.save();
      result.failed += 1;
      logger.warn({ err, rowId: row._id, attempts: row.attempts }, 'Notification delivery failed');
    }
  }
  return result;
}

export function startOutbox(intervalMs = 1000) {
  timer = setInterval(() => {
    if (flushing) return;
    flushing = flushOutbox()
      .catch((err) => logger.error({ err }, 'Outbox flush failed'))
      .finally(() => {
        flushing = null;
      });
  }, intervalMs);
}

export async function stopOutbox() {
  clearInterval(timer);
  await flushing;
}
