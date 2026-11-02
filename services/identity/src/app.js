import { Router } from 'express';
import { createServiceApp } from '@playloop/kit';
import { accessRoutes } from './modules/accounts/access.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';

const routes = Router();
routes.use('/auth', authRoutes);

export const createApp = () => createServiceApp({ routes, internalRoutes: accessRoutes });
