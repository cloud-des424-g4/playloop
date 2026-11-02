import { Router } from 'express';
import { buildStatus, internalGuard, monthlyBadges } from './internal.controller.js';

export const internalRoutes = Router();

internalRoutes.post('/builds/:buildId/status', internalGuard, buildStatus);
internalRoutes.post('/badges/monthly', internalGuard, monthlyBadges);
