import mongoose from 'mongoose';
import { ApiError } from '@playloop/kit';
import { Featured } from './featured.model.js';
import { toGameCard } from '../games/game.service.js';
import { Game } from '../games/game.model.js';
import { Review } from '../reviews/review.model.js';
import { USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { Member } from '../users/member.model.js';

export const visible = { status: 'published', deletedAt: null, hiddenAt: null, removedAt: null };

async function bannedIds() {
  return Member.find({ status: 'banned' }).distinct('_id');
}

export async function featuredGames() {
  const doc = await Featured.findById('featured').populate({
    path: 'games',
    match: visible,
    populate: { path: 'owner', select: USER_SUMMARY_FIELDS },
  });
  return (doc?.games ?? []).filter(Boolean);
}

export async function listFeatured() {
  return { items: (await featuredGames()).map(toGameCard) };
}

export async function setFeatured(gameIds) {
  const games = await Game.find({ _id: { $in: gameIds }, ...visible });
  if (games.length !== gameIds.length) {
    throw ApiError.validation('Some fields are invalid', [
      { path: '/body/gameIds', message: 'Featured games must be published' },
    ]);
  }
  const byId = new Map(games.map((game) => [game._id.toString(), game]));
  const ordered = gameIds.map((id) => byId.get(id));
  await Game.populate(ordered, { path: 'owner', select: USER_SUMMARY_FIELDS });
  await Featured.findByIdAndUpdate(
    'featured',
    { games: ordered.map((game) => game._id) },
    { upsert: true, new: true },
  );
  return { items: ordered.map(toGameCard) };
}

async function popularGames(limit, { exclude = [], ownerId } = {}) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const banned = await bannedIds();
  const skipOwners = ownerId ? [...banned, new mongoose.Types.ObjectId(ownerId)] : banned;
  const ranked = await Game.aggregate([
    { $match: { ...visible, _id: { $nin: exclude }, owner: { $nin: skipOwners } } },
    {
      $lookup: {
        from: Review.collection.name,
        let: { game: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$game', '$$game'] },
                  { $eq: ['$status', 'submitted'] },
                  { $gte: ['$submittedAt', since] },
                ],
              },
              removedAt: null,
              hiddenAt: null,
            },
          },
          { $count: 'count' },
        ],
        as: 'recent',
      },
    },
    { $addFields: { recentReviews: { $ifNull: [{ $first: '$recent.count' }, 0] } } },
    { $sort: { recentReviews: -1, publishedAt: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 1 } },
  ]);
  const ids = ranked.map((row) => row._id);
  const games = await Game.find({ _id: { $in: ids } }).populate('owner', USER_SUMMARY_FIELDS);
  const byId = new Map(games.map((game) => [game._id.toString(), game]));
  return ids.map((id) => byId.get(id.toString()));
}

export async function listRecommendations(user, limit = 5) {
  const featured = await featuredGames();
  const picked = [];
  const seen = new Set();
  const reviewed = user
    ? await Review.find({ reviewer: user.id, status: 'submitted', removedAt: null }).select(
        'game gameVersion',
      )
    : [];
  const blocked = new Set(reviewed.map((review) => `${review.game}:${review.gameVersion}`));
  const add = (game) => {
    if (!game || picked.length >= limit) return;
    const id = game._id.toString();
    if (seen.has(id) || blocked.has(`${id}:${game.version}`)) return;
    if (user && game.owner._id.equals(user.id)) return;
    seen.add(id);
    picked.push(game);
  };

  if (user) {
    const me = await Member.findById(user.id);
    if (me?.favoriteGenres.length) {
      const banned = await bannedIds();
      const matches = await Game.find({
        ...visible,
        owner: { $ne: user.id, $nin: banned },
        genres: { $in: me.favoriteGenres },
      })
        .sort({ publishedAt: -1 })
        .limit(30)
        .populate('owner', USER_SUMMARY_FIELDS);
      for (const game of matches) add(game);
    }
  }

  if (picked.length < limit) {
    for (const game of featured) add(game);
  }
  if (picked.length < limit) {
    const candidates = await popularGames(limit + blocked.size, {
      exclude: [...seen].map((id) => new mongoose.Types.ObjectId(id)),
      ownerId: user?.id,
    });
    for (const game of candidates) add(game);
  }
  return { items: picked.map(toGameCard) };
}
