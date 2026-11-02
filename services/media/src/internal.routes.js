import { Router } from 'express';
import { gameMedia, takeUpload } from './modules/uploads/upload.service.js';

export const internalRoutes = Router();

internalRoutes.post('/uploads/take', async (req, res) => {
  const { uploadId, userId, purpose } = req.body;
  res.json(await takeUpload(uploadId, userId, purpose));
});

internalRoutes.post('/uploads/game-media', async (req, res) => {
  res.json({ items: await gameMedia(req.body) });
});
