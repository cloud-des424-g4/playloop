import mongoose from 'mongoose';
import { ApiError } from '@playloop/kit';
import { mediaUrl } from '../../utils/mediaUrl.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { attachBuilds, toBuild } from '../builds/build.service.js';
import { activeGenreKeys, getConfig } from '../meta/config.service.js';
import { awardAchievements } from '../reputation/reputation.service.js';
import { Review } from '../reviews/review.model.js';
import { resolveGameMedia, takeUpload } from '../media/media.client.js';
import { Member } from '../users/member.model.js';
import { Game } from './game.model.js';
import { defaultForm } from './game.defaults.js';
import {
  genreProblems,
  missionProblems,
  normalizePresets,
  publishProblems,
  questionProblems,
} from './game.validation.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asList = (value) => [].concat(value ?? []);

function throwIfProblems(problems, message = 'Some fields are invalid') {
  if (problems.length) throw ApiError.validation(message, problems);
}

async function findGame(gameId) {
  const game = await Game.findOne({ _id: gameId, deletedAt: null }).populate(
    'owner',
    USER_SUMMARY_FIELDS,
  );
  if (!game) throw ApiError.notFound('Game not found');
  return game;
}

const isOwner = (game, userId) => Boolean(userId) && game.owner._id.equals(userId);

export async function findOwnedGame(gameId, userId) {
  const game = await findGame(gameId);
  if (!isOwner(game, userId)) throw ApiError.forbidden();
  return game;
}

export async function createGame(userId, { title }) {
  const game = await Game.create({ owner: userId, title, form: defaultForm() });
  await game.populate('owner', USER_SUMMARY_FIELDS);
  return attachBuilds(game);
}

export async function getGame(gameId, user) {
  const game = await findGame(gameId);
  if (game.hiddenAt && user?.role !== 'admin' && !isOwner(game, user?.id)) {
    throw ApiError.notFound('Game not found');
  }
  const owner = await Member.findById(game.owner._id).select('status');
  if (owner?.status === 'banned' && user?.role !== 'admin' && !isOwner(game, user?.id)) {
    throw ApiError.notFound('Game not found');
  }
  if (game.status === 'draft' && !isOwner(game, user?.id))
    throw ApiError.notFound('Game not found');
  return attachBuilds(game);
}

export async function updateGame(gameId, userId, input) {
  const game = await findOwnedGame(gameId, userId);
  const { mediaIds, theme, delivery, ...fields } = input;

  await getConfig();
  throwIfProblems(genreProblems(fields.genres, activeGenreKeys()));
  if (mediaIds) game.media = await resolveGameMedia(game, mediaIds, userId);
  if (theme?.backgroundUploadId) {
    const upload = await takeUpload(theme.backgroundUploadId, userId, 'game_background');
    if (upload.game && !game._id.equals(upload.game)) {
      throw ApiError.validation('Some fields are invalid', [
        { path: '/body/theme/backgroundUploadId', message: 'This upload belongs to another game' },
      ]);
    }
    game.theme.backgroundKey = upload.key;
  }

  game.set(fields);
  if (theme) {
    if (theme.backgroundPreset && !theme.backgroundUploadId) {
      game.set({ 'theme.backgroundPreset': theme.backgroundPreset, 'theme.backgroundKey': null });
    }
    if (theme.accentColor) game.theme.accentColor = theme.accentColor;
    if (theme.controlsCardColor) game.theme.controlsCardColor = theme.controlsCardColor;
  }
  if (delivery) game.set({ delivery: { ...game.delivery.toObject(), ...delivery } });

  if (game.status === 'published') {
    await attachBuilds(game);
    throwIfProblems(publishProblems(game), 'A published game must stay complete');
    if (game.isModified('version')) game.lastUpdatedAt = new Date();
  }
  await game.save();
  return attachBuilds(game);
}

export async function deleteGame(gameId, userId) {
  const game = await findOwnedGame(gameId, userId);
  game.deletedAt = new Date();
  await game.save();
  await Review.deleteMany({ game: game._id, status: 'in_progress' });
}

export async function publishGame(gameId, userId) {
  const game = await findOwnedGame(gameId, userId);
  if (game.status === 'published') throw ApiError.conflict('Game is already published');
  await attachBuilds(game);
  throwIfProblems(publishProblems(game), 'Finish these before publishing');
  const now = new Date();
  game.set({ status: 'published', lastUpdatedAt: now, publishedAt: game.publishedAt ?? now });
  await game.save();
  await awardAchievements(userId);
  return attachBuilds(game);
}

export async function unpublishGame(gameId, userId) {
  const game = await findOwnedGame(gameId, userId);
  if (game.status === 'draft') throw ApiError.conflict('Game is already a draft');
  game.status = 'draft';
  await game.save();
  return attachBuilds(game);
}

export const getForm = findOwnedGame;

export async function updateForm(gameId, userId, input) {
  const game = await findOwnedGame(gameId, userId);
  const { firstImpression, playtest, finalVerdict } = input;
  const problems = [];

  if (firstImpression) {
    problems.push(
      ...questionProblems(firstImpression.questions, '/body/firstImpression/questions'),
    );
    game.form.firstImpression.questions = normalizePresets(firstImpression.questions);
  }
  if (playtest) {
    problems.push(
      ...missionProblems(playtest.missions, '/body/playtest/missions'),
      ...questionProblems(playtest.questions, '/body/playtest/questions'),
    );
    if (game.status === 'published' && !playtest.missions.length) {
      problems.push({
        path: '/body/playtest/missions',
        message: 'A published game needs at least one mission',
      });
    }
    game.form.playtest = {
      ...playtest,
      questions: playtest.questions.map(({ preset: _preset, ...question }) => question),
    };
  }
  if (finalVerdict) game.form.finalVerdict = finalVerdict;
  throwIfProblems(problems);

  game.form.revision += 1;
  game.form.updatedAt = new Date();
  game.markModified('form');
  return game.save();
}

export async function listGames(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const banned = await Member.find({ status: 'banned' }).distinct('_id');
  const filter = {
    status: 'published',
    deletedAt: null,
    hiddenAt: null,
    removedAt: null,
    ...(banned.length && { owner: { $nin: banned } }),
  };
  if (query.search) filter.title = { $regex: escapeRegex(query.search), $options: 'i' };
  for (const [param, field] of [
    ['genre', 'genres'],
    ['platform', 'platforms'],
    ['buildStage', 'buildStage'],
  ]) {
    const values = asList(query[param]);
    if (values.length) filter[field] = { $in: values };
  }
  if (query.sort === 'popular') {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ranked = await Review.aggregate([
      {
        $match: {
          status: 'submitted',
          hiddenAt: null,
          removedAt: null,
          submittedAt: { $gte: since },
        },
      },
      { $group: { _id: '$game', count: { $sum: 1 } } },
    ]);
    const counts = new Map(ranked.map((row) => [row._id.toString(), row.count]));
    const games = await Game.find(filter).populate('owner', USER_SUMMARY_FIELDS);
    games.sort(
      (a, b) =>
        (counts.get(b._id.toString()) ?? 0) - (counts.get(a._id.toString()) ?? 0) ||
        b.publishedAt - a.publishedAt,
    );
    return {
      items: games.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: games.length,
    };
  }

  const [items, total] = await Promise.all([
    Game.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', USER_SUMMARY_FIELDS),
    Game.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

export async function listPublishedByOwner(ownerId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = {
    owner: ownerId,
    status: 'published',
    deletedAt: null,
    hiddenAt: null,
    removedAt: null,
  };
  const [items, total] = await Promise.all([
    Game.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', USER_SUMMARY_FIELDS),
    Game.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

export async function listMyGames(userId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const owner = new mongoose.Types.ObjectId(userId);
  const filter = { owner, deletedAt: null, ...(query.status && { status: query.status }) };

  const [items, total, groups] = await Promise.all([
    Game.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Game.countDocuments(filter),
    Game.aggregate([
      { $match: { owner, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 }, reviews: { $sum: '$reviewCount' } } },
    ]),
  ]);
  const newCounts = await Review.aggregate([
    {
      $match: {
        game: { $in: items.map((g) => g._id) },
        status: 'submitted',
        feedbackStatus: 'new',
      },
    },
    { $group: { _id: '$game', count: { $sum: 1 } } },
  ]);
  const newByGame = new Map(newCounts.map((c) => [c._id.toString(), c.count]));
  for (const game of items) game.$locals.newReviewCount = newByGame.get(game._id.toString()) ?? 0;

  const byStatus = Object.fromEntries(groups.map((g) => [g._id, g]));
  const summary = {
    published: byStatus.published?.count ?? 0,
    drafts: byStatus.draft?.count ?? 0,
    reviewsReceived: groups.reduce((sum, g) => sum + g.reviews, 0),
  };
  return { items, page, limit, total, summary };
}

const estimatedMinutes = (game) =>
  game.form.playtest.missions.reduce((sum, mission) => sum + mission.minutes, 0);

export const coverUrl = (game) => mediaUrl(game.media.find((m) => m.type === 'image')?.key);

export const toGameRef = (game) => ({
  id: game._id.toString(),
  title: game.title,
  coverUrl: coverUrl(game),
  deleted: Boolean(game.deletedAt),
});

export const toTheme = (theme) => ({
  backgroundPreset: theme.backgroundKey ? null : theme.backgroundPreset,
  backgroundImageUrl: mediaUrl(theme.backgroundKey),
  accentColor: theme.accentColor,
  controlsCardColor: theme.controlsCardColor,
});

export function toGameCard(game) {
  return {
    id: game._id.toString(),
    title: game.title,
    pitch: game.pitch,
    coverUrl: coverUrl(game),
    genres: [...game.genres],
    platforms: [...game.platforms],
    buildStage: game.buildStage,
    engine: game.engine,
    estimatedMinutes: estimatedMinutes(game),
    reviewCount: game.reviewCount,
    owner: toUserSummary(game.owner),
    publishedAt: game.publishedAt,
  };
}

export function toGameDetail(game, userId) {
  const { delivery } = game;
  return {
    id: game._id.toString(),
    status: game.status,
    owner: toUserSummary(game.owner),
    title: game.title,
    pitch: game.pitch,
    genres: [...game.genres],
    platforms: [...game.platforms],
    ...(game.buildStage && { buildStage: game.buildStage }),
    version: game.version,
    lastUpdatedAt: game.lastUpdatedAt,
    media: game.media.map((m) => ({ id: m._id.toString(), type: m.type, url: mediaUrl(m.key) })),
    contentWarnings: [...game.contentWarnings],
    coreGameplay: [...game.coreGameplay],
    playable: [...game.playable],
    controls: game.controls.map(({ key, action }) => ({ key, action })),
    devNotes: game.devNotes,
    ...(game.engine && { engine: game.engine }),
    engineOther: game.engineOther,
    credits: game.credits.map(({ role, name }) => ({ role, name })),
    theme: toTheme(game.theme),
    delivery: {
      ...(delivery.method && { method: delivery.method }),
      webUrl: delivery.webUrl,
      builds: (game.$locals.builds ?? []).map(toBuild),
    },
    playtest: {
      missionCount: game.form.playtest.missions.length,
      estimatedMinutes: estimatedMinutes(game),
    },
    reviewCount: game.reviewCount,
    isOwner: isOwner(game, userId),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    publishedAt: game.publishedAt,
  };
}

export function toMyGameItem(game) {
  return {
    id: game._id.toString(),
    title: game.title,
    pitch: game.pitch,
    coverUrl: coverUrl(game),
    status: game.status,
    ...(game.buildStage && { buildStage: game.buildStage }),
    ...(game.engine && { engine: game.engine }),
    platforms: [...game.platforms],
    reviewCount: game.reviewCount,
    newReviewCount: game.$locals.newReviewCount ?? 0,
    updatedAt: game.updatedAt,
  };
}

export function toForm(game) {
  const { form } = game;
  return {
    gameId: game._id.toString(),
    revision: form.revision,
    firstImpression: { questions: form.firstImpression.questions },
    playtest: {
      missions: form.playtest.missions.map(({ id, title, minutes }) => ({ id, title, minutes })),
      knownIssues: [...form.playtest.knownIssues],
      questions: form.playtest.questions,
    },
    finalVerdict: { farewellMessage: form.finalVerdict.farewellMessage },
    estimatedMinutes: estimatedMinutes(game),
    updatedAt: form.updatedAt,
  };
}
