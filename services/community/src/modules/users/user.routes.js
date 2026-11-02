import { Router } from 'express';
import { optionalAuth } from '../../middleware/auth.js';
import * as controller from './user.controller.js';

export const userRoutes = Router();

userRoutes.get('/:username', optionalAuth, controller.getProfile);
userRoutes.get('/:username/games', controller.listGames);
userRoutes.get('/:username/reviews', controller.listReviews);
