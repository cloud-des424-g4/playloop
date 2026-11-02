import { ApiError, internalClient } from '@playloop/kit';
import { Notification } from './notification.model.js';

const community = internalClient('COMMUNITY_URL');
const NO_REFS = { users: {}, games: {} };

export async function deliverNotification({ id, ...notification }) {
  try {
    await Notification.create({ _id: id, ...notification });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

export async function listNotifications(userId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const unreadOnly = query.unreadOnly === true || query.unreadOnly === 'true';
  const filter = { user: userId, ...(unreadOnly && { read: false }) };
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, read: false }),
  ]);
  return { items, page, limit, total, unreadCount };
}

export async function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, read: false });
}

export async function markRead(userId, notificationId) {
  const result = await Notification.updateOne(
    { _id: notificationId, user: userId },
    { read: true },
  );
  if (!result.matchedCount) throw ApiError.notFound('Notification not found');
}

export async function markAllRead(userId) {
  await Notification.updateMany({ user: userId, read: false }, { read: true });
}

export async function loadRefs(items) {
  const ids = (field) => [...new Set(items.flatMap((item) => item[field]?.toString() ?? []))];
  const [users, games] = [ids('actor'), ids('game')];
  if (!users.length && !games.length) return NO_REFS;
  try {
    return await community.post('/internal/refs', { users, games });
  } catch (err) {
    if (err.status === 503) return NO_REFS;
    throw err;
  }
}

export function toNotification(notification, refs) {
  const actor = refs.users[notification.actor];
  const game = refs.games[notification.game];
  return {
    id: notification._id.toString(),
    type: notification.type,
    read: notification.read,
    message: notification.message,
    link: notification.link,
    ...(actor && { actor }),
    ...(game && { game }),
    ...(notification.reviewId && { reviewId: notification.reviewId.toString() }),
    createdAt: notification.createdAt,
  };
}
