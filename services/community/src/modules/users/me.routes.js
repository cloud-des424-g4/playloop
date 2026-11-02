import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './me.controller.js';

export const meRoutes = Router();

meRoutes.get('/', requireAuth, controller.getMe);
meRoutes.patch('/', requireAuth, controller.updateMe);
