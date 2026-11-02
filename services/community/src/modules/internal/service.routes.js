import { Router } from 'express';
import { checkUploadTarget } from '../games/upload-target.service.js';
import { ensureMember } from '../users/user.service.js';
import { refs } from './refs.service.js';

export const serviceRoutes = Router();

serviceRoutes.post('/refs', async (req, res) => {
  res.json(await refs(req.body));
});

serviceRoutes.post('/upload-targets/check', async (req, res) => {
  await checkUploadTarget(req.body);
  res.status(204).end();
});

serviceRoutes.put('/members/:id', async (req, res) => {
  res.json(await ensureMember(req.params.id, req.body));
});
