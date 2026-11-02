import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { internalClient } from '@playloop/kit';
import { Outbox } from '../../community/src/modules/outbox/outbox.model.js';
import {
  flushOutbox,
  notify,
  retryDelayMs,
} from '../../community/src/modules/outbox/outbox.service.js';
import { Notification } from '../../notifications/src/modules/notifications/notification.model.js';
import { createUser } from './helpers.js';
import { settle, withServiceDown } from './stack.js';

const note = (user, overrides = {}) => ({
  user: user._id,
  type: 'test',
  message: 'Hello',
  link: '/somewhere',
  ...overrides,
});

describe('notification outbox', () => {
  it('delivers a row from a committed transaction', async () => {
    const user = await createUser();
    await mongoose.connection.transaction((session) => notify(note(user), session));

    expect(await settle()).toEqual({ sent: 1, failed: 0 });
    expect(await Notification.countDocuments({ user: user._id })).toBe(1);
    expect(await Outbox.countDocuments()).toBe(0);
  });

  it('drops a row from an aborted transaction', async () => {
    const user = await createUser();
    await expect(
      mongoose.connection.transaction(async (session) => {
        await notify(note(user), session);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    expect(await settle()).toEqual({ sent: 0, failed: 0 });
  });

  it('keeps a failed row and schedules a retry', async () => {
    const user = await createUser();
    await notify(note(user));
    const now = new Date();

    const result = await withServiceDown('notifications', () => flushOutbox({ now }));

    expect(result).toEqual({ sent: 0, failed: 1 });
    const row = await Outbox.findOne();
    expect(row.attempts).toBe(1);
    expect(row.nextAttemptAt.getTime()).toBe(now.getTime() + 2000);
  });

  it('skips a row until its retry is due', async () => {
    const user = await createUser();
    const later = new Date(Date.now() + 60_000);
    await Outbox.create({ payload: note(user), nextAttemptAt: later });

    expect(await settle()).toEqual({ sent: 0, failed: 0 });
    expect(await flushOutbox({ now: later })).toEqual({ sent: 1, failed: 0 });
  });

  it('caps the retry delay at 300 seconds', () => {
    expect(retryDelayMs(1)).toBe(2000);
    expect(retryDelayMs(9)).toBe(300_000);
  });

  it("doesn't duplicate a repeated delivery", async () => {
    const user = await createUser();
    const client = internalClient('NOTIFICATIONS_URL');
    const body = { id: new mongoose.Types.ObjectId(), ...note(user) };

    await client.post('/internal/notifications', body);
    await client.post('/internal/notifications', body);

    expect(await Notification.countDocuments({ user: user._id })).toBe(1);
  });

  it('keeps the original time on a late delivery', async () => {
    const user = await createUser();
    const yesterday = new Date(Date.now() - 86_400_000);
    await Outbox.create({ payload: note(user), createdAt: yesterday });

    await settle();

    expect((await Notification.findOne({ user: user._id })).createdAt).toEqual(yesterday);
  });

  it("doesn't let a row that can't be delivered block newer rows", async () => {
    const user = await createUser();
    await Outbox.create({
      payload: note(user, { message: undefined }),
      createdAt: new Date(Date.now() - 1000),
    });
    await notify(note(user));

    expect(await settle()).toEqual({ sent: 1, failed: 1 });
    expect(await Notification.countDocuments({ user: user._id })).toBe(1);
  });
});
