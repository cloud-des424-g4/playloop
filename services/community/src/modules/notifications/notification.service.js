import { mediaUrl } from '../../utils/mediaUrl.js';
import { ApiError } from '@playloop/kit';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { Notification } from './notification.model.js';

const gameRef = (game) =>
  game
    ? {
        id: game._id.toString(),
        title: game.title,
        coverUrl: mediaUrl(game.media?.find((item) => item.type === 'image')?.key),
        deleted: Boolean(game.deletedAt),
      }
    : undefined;

export async function notify(input, session) {
  const [doc] = await Notification.create(
    [
      {
        user: input.user,
        type: input.type,
        message: input.message,
        link: input.link,
        actor: input.actor,
        game: input.game,
        reviewId: input.reviewId,
      },
    ],
    { session },
  );
  return doc;
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
      .limit(limit)
      .populate('actor', USER_SUMMARY_FIELDS)
      .populate('game', 'title media deletedAt'),
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

export function toNotification(notification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    read: notification.read,
    message: notification.message,
    link: notification.link,
    ...(notification.actor && { actor: toUserSummary(notification.actor) }),
    ...(notification.game && { game: gameRef(notification.game) }),
    ...(notification.reviewId && { reviewId: notification.reviewId.toString() }),
    createdAt: notification.createdAt,
  };
}
