import { Router } from 'express';
import { createServiceApp } from '@playloop/kit';
import { internalRoutes } from './internal.routes.js';
import { uploadRoutes } from './modules/uploads/upload.routes.js';

const routes = Router();
routes.use('/uploads', uploadRoutes);

export const createApp = () => createServiceApp({ routes, internalRoutes });
