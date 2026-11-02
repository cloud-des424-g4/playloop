import { Router } from 'express';
import { dbState } from './db.js';

export const healthRoutes = Router();

healthRoutes.get('/', (_req, res) => {
  res.json({ status: 'ok', db: dbState(), uptime: Math.round(process.uptime()) });
});
