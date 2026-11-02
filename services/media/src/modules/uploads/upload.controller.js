import * as uploads from './upload.service.js';

export async function createUpload(req, res) {
  res.status(201).json(await uploads.createUpload(req.user.id, req.body));
}

export async function completeUpload(req, res) {
  res.json(await uploads.completeUpload(req.user.id, req.params.uploadId, req.body ?? {}));
}
