import jwt from 'jsonwebtoken';
import { env } from '@playloop/kit';
import { ApiError } from '@playloop/kit';
import { coverUrl } from '../games/game.service.js';
import { Game } from '../games/game.model.js';
import { startReview } from '../reviews/review.service.js';
import { Review } from '../reviews/review.model.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { Member } from '../users/member.model.js';

const minutes = (game) =>
  game.form.playtest.missions.reduce((sum, mission) => sum + mission.minutes, 0);

function toRouletteGame(game) {
  return {
    id: game._id.toString(),
    title: game.title,
    pitch: game.pitch,
    coverUrl: coverUrl(game),
    genres: [...game.genres],
    platforms: [...game.platforms],
    buildStage: game.buildStage,
    engine: game.engine,
    deliveryMethod: game.delivery.method,
    missionCount: game.form.playtest.missions.length,
    estimatedMinutes: minutes(game),
    owner: toUserSummary(game.owner),
  };
}

export async function spin(userId, input) {
  const banned = await Member.find({ status: 'banned' }).distinct('_id');
  const filter = {
    status: 'published',
    deletedAt: null,
    hiddenAt: null,
    removedAt: null,
    owner: { $ne: userId, $nin: banned },
    'form.playtest.missions.0': { $exists: true },
  };
  if (input.platform) filter.platforms = input.platform;
  if (input.buildStage) filter.buildStage = input.buildStage;
  if (input.genres?.length) filter.genres = { $in: input.genres };
  if (input.exclude?.length) filter._id = { $nin: input.exclude };

  const reviewed = await Review.find({
    reviewer: userId,
    status: 'submitted',
    removedAt: null,
  }).select('game gameVersion');
  const blocked = new Set(reviewed.map((review) => `${review.game}:${review.gameVersion}`));

  let games = await Game.find(filter).limit(200).populate('owner', USER_SUMMARY_FIELDS);
  games = games.filter((game) => !blocked.has(`${game._id}:${game.version}`));
  if (input.maxMinutes) games = games.filter((game) => minutes(game) <= input.maxMinutes);
  if (!games.length) throw ApiError.noMatch();

  const game = games[Math.floor(Math.random() * games.length)];
  const spinToken = jwt.sign(
    { sub: userId, gameId: game._id.toString(), purpose: 'roulette' },
    env.jwtSecret,
    { expiresIn: '15m' },
  );
  return { spinToken, game: toRouletteGame(game) };
}

export async function accept(userId, spinToken) {
  let payload;
  try {
    payload = jwt.verify(spinToken, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw ApiError.validation('This spin has expired. Spin again.');
  }
  if (payload.purpose !== 'roulette' || payload.sub !== userId) {
    throw ApiError.validation('This spin has expired. Spin again.');
  }
  return startReview(payload.gameId, userId, 'roulette');
}
