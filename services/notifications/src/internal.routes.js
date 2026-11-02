import { Router } from 'express';
import { deliverNotification } from './modules/notifications/notification.service.js';

export const internalRoutes = Router();

internalRoutes.post('/notifications', async (req, res) => {
  await deliverNotification(req.body);
  res.status(204).end();
});
