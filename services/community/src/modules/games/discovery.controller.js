import { listFeatured, listRecommendations } from './discovery.service.js';

export async function recommendations(req, res) {
  res.json(await listRecommendations(req.user, req.query.limit ?? 5));
}

export async function featured(_req, res) {
  res.json(await listFeatured());
}
