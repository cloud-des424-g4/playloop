import { createServiceApp } from '@playloop/kit';
import { routes } from './routes.js';

export const createApp = () => createServiceApp({ routes, docs: true });
