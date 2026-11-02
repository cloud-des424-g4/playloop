import * as builds from './build.service.js';

export async function addBuild(req, res) {
  res
    .status(201)
    .json(builds.toBuild(await builds.addBuild(req.params.gameId, req.user.id, req.body)));
}

export async function deleteBuild(req, res) {
  await builds.deleteBuild(req.params.gameId, req.user.id, req.params.buildId);
  res.status(204).end();
}

export async function downloadBuild(req, res) {
  res.json(await builds.downloadLink(req.params.gameId, req.user, req.params.buildId));
}
