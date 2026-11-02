import * as reviews from '../reviews/review.service.js';
import * as roulette from './roulette.service.js';

export async function spin(req, res) {
  res.json(await roulette.spin(req.user.id, req.body));
}

export async function accept(req, res) {
  const { review, created } = await roulette.accept(req.user.id, req.body.spinToken);
  res.status(created ? 201 : 200).json(await reviews.toReview(review, req.user.id));
}
