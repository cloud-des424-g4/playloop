import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as notifications from './notification.service.js';

export const notificationRoutes = Router();

notificationRoutes.get('/', requireAuth, async (req, res) => {
  const result = await notifications.listNotifications(req.user.id, req.query);
  const refs = await notifications.loadRefs(result.items);
  res.json({
    ...result,
    items: result.items.map((item) => notifications.toNotification(item, refs)),
  });
});
notificationRoutes.get('/unread-count', requireAuth, async (req, res) => {
  res.json({ count: await notifications.unreadCount(req.user.id) });
});
notificationRoutes.post('/read-all', requireAuth, async (req, res) => {
  await notifications.markAllRead(req.user.id);
  res.status(204).end();
});
notificationRoutes.post('/:notificationId/read', requireAuth, async (req, res) => {
  await notifications.markRead(req.user.id, req.params.notificationId);
  res.status(204).end();
});
