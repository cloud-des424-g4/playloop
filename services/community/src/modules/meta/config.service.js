import { BADGES, DEFAULT_GENRES, LEVELS, REPUTATION_POINTS } from '@playloop/shared';
import { ApiError } from '@playloop/kit';
import { Config } from './config.model.js';

const GENRE_LABELS = {
  action: 'Action',
  adventure: 'Adventure',
  exploration: 'Exploration',
  fantasy: 'Fantasy',
  horror: 'Horror',
  mystery: 'Mystery',
  racing: 'Racing',
  rpg: 'RPG',
  shooter: 'Shooter',
  survival: 'Survival',
  tactical: 'Tactical',
};

export const defaultGenres = () =>
  DEFAULT_GENRES.map((key) => ({ key, label: GENRE_LABELS[key] ?? key, active: true }));

export const defaultBadges = () =>
  BADGES.map((badge) => ({
    key: badge.key,
    name: badge.name,
    description: badge.description,
    kind: badge.kind,
    threshold: badge.threshold ?? null,
    active: true,
  }));

const defaults = () => ({
  _id: 'config',
  genres: defaultGenres(),
  levels: LEVELS.map((level) => ({ ...level })),
  badges: defaultBadges(),
  reputationPoints: { ...REPUTATION_POINTS },
});

let cache;

function remember(config) {
  cache = config;
  return config;
}

export function runtimeConfig() {
  return cache ?? defaults();
}

export async function getConfig() {
  const existing = await Config.findById('config');
  if (existing) return remember(existing);
  try {
    return remember(await Config.create(defaults()));
  } catch (err) {
    if (err.code !== 11000) throw err;
    return remember(await Config.findById('config'));
  }
}

export function activeGenreKeys() {
  return runtimeConfig()
    .genres.filter((genre) => genre.active)
    .map((genre) => genre.key);
}

function duplicateKeys(items, field = 'key') {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item[field])) return true;
    seen.add(item[field]);
    return false;
  });
}

export async function updateConfig(input) {
  const config = await getConfig();

  if (input.genres) {
    const removed = config.genres.filter(
      (genre) => !input.genres.some((next) => next.key === genre.key),
    );
    if (removed.length || duplicateKeys(input.genres).length) {
      throw ApiError.validation('Some fields are invalid', [
        {
          path: '/body/genres',
          message: removed.length
            ? `Genre keys cannot be removed: ${removed.map((genre) => genre.key).join(', ')}`
            : 'Genre keys must be unique',
        },
      ]);
    }
    config.genres = input.genres;
  }

  if (input.levels) {
    const problems = [];
    if (input.levels[0]?.minPoints !== 0) {
      problems.push({ path: '/body/levels', message: 'The first level must start at 0 points' });
    }
    input.levels.forEach((level, index) => {
      const previous = input.levels[index - 1];
      if (previous && level.minPoints <= previous.minPoints) {
        problems.push({
          path: `/body/levels/${index}/minPoints`,
          message: 'Points must increase with each level',
        });
      }
      if (level.level !== index + 1) {
        problems.push({
          path: `/body/levels/${index}/level`,
          message: 'Levels must be numbered 1, 2, 3…',
        });
      }
    });
    if (problems.length) throw ApiError.validation('Some fields are invalid', problems);
    config.levels = input.levels;
  }

  if (input.badges) {
    if (duplicateKeys(input.badges).length) {
      throw ApiError.validation('Some fields are invalid', [
        { path: '/body/badges', message: 'Badge keys must be unique' },
      ]);
    }
    config.badges = input.badges;
  }

  if (input.reputationPoints) config.reputationPoints = input.reputationPoints;
  await config.save();
  return remember(config);
}

export function toConfig(config) {
  return {
    genres: config.genres.map(({ key, label, active }) => ({ key, label, active })),
    levels: config.levels.map(({ level, title, minPoints }) => ({ level, title, minPoints })),
    badges: config.badges.map(({ key, name, description, kind, threshold, active }) => ({
      key,
      name,
      description,
      kind,
      threshold: threshold ?? null,
      active,
    })),
    reputationPoints: { ...(config.reputationPoints.toObject?.() ?? config.reputationPoints) },
    updatedAt: config.updatedAt,
  };
}
