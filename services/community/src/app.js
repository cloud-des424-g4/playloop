import { createServiceApp } from '@playloop/kit';
import { serviceRoutes } from './modules/internal/service.routes.js';
import { routes } from './routes.js';

export const createApp = () =>
  createServiceApp({ routes, internalRoutes: serviceRoutes, docs: true });
