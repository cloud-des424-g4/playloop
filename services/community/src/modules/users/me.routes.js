import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as notifications from '../notifications/notification.service.js';
import * as controller from './me.controller.js';

export const meRoutes = Router();

meRoutes.get('/', requireAuth, controller.getMe);
meRoutes.patch('/', requireAuth, controller.updateMe);
meRoutes.get('/notifications', requireAuth, async (req, res) => {
  const result = await notifications.listNotifications(req.user.id, req.query);
  res.json({ ...result, items: result.items.map(notifications.toNotification) });
});
meRoutes.get('/notifications/unread-count', requireAuth, async (req, res) => {
  res.json({ count: await notifications.unreadCount(req.user.id) });
});
meRoutes.post('/notifications/read-all', requireAuth, async (req, res) => {
  await notifications.markAllRead(req.user.id);
  res.status(204).end();
});
meRoutes.post('/notifications/:notificationId/read', requireAuth, async (req, res) => {
  await notifications.markRead(req.user.id, req.params.notificationId);
  res.status(204).end();
});
