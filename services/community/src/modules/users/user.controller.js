import * as games from '../games/game.service.js';
import * as reviews from '../reviews/review.service.js';
import * as users from './user.service.js';

export async function getProfile(req, res) {
  res.json(await users.getPublicProfile(req.params.username, req.user?.id));
}

export async function listGames(req, res) {
  const user = await users.findByUsername(req.params.username);
  if (user.status === 'banned') {
    return res.json({
      items: [],
      page: req.query.page ?? 1,
      limit: req.query.limit ?? 20,
      total: 0,
    });
  }
  const result = await games.listPublishedByOwner(user._id, req.query);
  res.json({ ...result, items: result.items.map(games.toGameCard) });
}

export async function listReviews(req, res) {
  const user = await users.findByUsername(req.params.username);
  if (user.status === 'banned') {
    return res.json({
      items: [],
      page: req.query.page ?? 1,
      limit: req.query.limit ?? 20,
      total: 0,
    });
  }
  const result = await reviews.listProfileReviews(user._id, req.query);
  res.json({ ...result, items: result.items.map(reviews.toProfileReviewItem) });
}
