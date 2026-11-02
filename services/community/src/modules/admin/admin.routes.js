import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import * as controller from './admin.controller.js';

export const adminRoutes = Router();

adminRoutes.use(requireAdmin);
adminRoutes.get('/stats', controller.stats);
adminRoutes.get('/reports', controller.listReports);
adminRoutes.patch('/reports/:reportId', controller.resolveReport);
adminRoutes.get('/content', controller.listContent);
adminRoutes.post('/content/:targetType/:targetId/hide', controller.hideContent);
adminRoutes.post('/content/:targetType/:targetId/restore', controller.restoreContent);
adminRoutes.delete('/content/:targetType/:targetId', controller.removeContent);
adminRoutes.get('/users', controller.listUsers);
adminRoutes.get('/users/:userId', controller.getUser);
adminRoutes.post('/users/:userId/suspend', controller.suspendUser);
adminRoutes.post('/users/:userId/unsuspend', controller.unsuspendUser);
adminRoutes.put('/users/:userId/role', controller.setRole);
adminRoutes.get('/games', controller.listGames);
adminRoutes.get('/history', controller.listHistory);
adminRoutes.get('/featured', controller.getFeatured);
adminRoutes.put('/featured', controller.setFeatured);
adminRoutes.get('/config', controller.getConfig);
adminRoutes.patch('/config', controller.updateConfig);
