import {
  AUDIENCES,
  BUILD_STAGES,
  CARD_TYPES,
  COMPARISONS,
  DIFFICULTY_LEVELS,
  ENGINES,
  FEEDBACK_STATUSES,
  IMPROVE_CATEGORIES,
  PLATFORMS,
  QUESTION_TYPES,
  ROULETTE_TIME_LIMITS,
  STRENGTHS,
} from '@playloop/shared';
import { getLeaderboard } from '../reputation/reputation.service.js';
import { uploadLimitsForMeta } from '../uploads/upload.service.js';
import { getConfig } from './config.service.js';

const REPORT_REASONS = ['spam', 'offensive', 'inappropriate', 'cheating', 'broken_game', 'other'];
const REACTIONS = ['thumbs_up', 'heart', 'laugh', 'wow', 'fire', 'clap'];
const BACKGROUNDS = ['sky', 'storm', 'overcast', 'night'];

export async function meta(_req, res) {
  const config = await getConfig();
  res.json({
    genres: config.genres.filter((genre) => genre.active).map(({ key, label }) => ({ key, label })),
    platforms: PLATFORMS,
    buildStages: BUILD_STAGES,
    engines: ENGINES,
    backgroundPresets: BACKGROUNDS,
    questionTypes: QUESTION_TYPES,
    cardTypes: CARD_TYPES,
    feedbackStatuses: FEEDBACK_STATUSES,
    difficultyLevels: DIFFICULTY_LEVELS,
    strengths: STRENGTHS,
    audiences: AUDIENCES,
    comparisons: COMPARISONS,
    improveCategories: IMPROVE_CATEGORIES,
    reactionEmojis: REACTIONS,
    reportReasons: REPORT_REASONS,
    rouletteTimes: ROULETTE_TIME_LIMITS,
    levels: config.levels.map(({ level, title, minPoints }) => ({ level, title, minPoints })),
    badges: config.badges
      .filter((badge) => badge.active)
      .map(({ key, name, description, kind }) => ({ key, name, description, kind })),
    uploadLimits: uploadLimitsForMeta(),
  });
}

export async function leaderboard(req, res) {
  res.json(await getLeaderboard(req.query.period ?? 'all_time', req.query.limit ?? 10));
}
