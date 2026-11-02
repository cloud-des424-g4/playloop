import * as admin from './admin.service.js';

export async function stats(req, res) {
  res.json(await admin.stats(req.query.days ?? 30));
}

export async function listReports(req, res) {
  res.json(await admin.listReports(req.query));
}

export async function resolveReport(req, res) {
  res.json(await admin.resolveReport(req.params.reportId, req.user.id, req.body));
}

export async function hideContent(req, res) {
  res.json(
    await admin.hideContent(
      req.params.targetType,
      req.params.targetId,
      req.body.reason,
      req.user.id,
    ),
  );
}

export async function restoreContent(req, res) {
  res.json(await admin.restoreContent(req.params.targetType, req.params.targetId, req.user.id));
}

export async function removeContent(req, res) {
  await admin.removeContent(req.params.targetType, req.params.targetId, req.user.id);
  res.status(204).end();
}

export async function listUsers(req, res) {
  res.json(await admin.listUsers(req.query));
}

export async function getUser(req, res) {
  res.json(await admin.getUser(req.params.userId));
}

export async function suspendUser(req, res) {
  res.json(await admin.suspendUser(req.params.userId, req.user.id, req.body));
}

export async function unsuspendUser(req, res) {
  res.json(await admin.unsuspendUser(req.params.userId, req.user.id));
}

export async function setRole(req, res) {
  res.json(await admin.setRole(req.params.userId, req.user.id, req.body.role));
}

export async function getFeatured(_req, res) {
  res.json(await admin.listFeatured());
}

export async function setFeatured(req, res) {
  res.json(await admin.setFeatured(req.body.gameIds));
}

export async function getConfig(_req, res) {
  res.json(admin.toConfig(await admin.getConfig()));
}

export async function updateConfig(req, res) {
  res.json(admin.toConfig(await admin.updateConfig(req.body)));
}

export async function listContent(req, res) {
  res.json(await admin.listContent(req.query));
}

export async function listGames(req, res) {
  res.json(await admin.listGames(req.query));
}

export async function listHistory(req, res) {
  res.json(await admin.listHistory(req.query));
}
