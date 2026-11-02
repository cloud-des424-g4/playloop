import { Router } from 'express';
import { createServiceApp } from '@playloop/kit';
import { internalRoutes } from './internal.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';

const routes = Router();
routes.use('/me/notifications', notificationRoutes);

export const createApp = () => createServiceApp({ routes, internalRoutes });
