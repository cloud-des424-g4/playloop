import { DEFAULT_GENRES } from '@playloop/shared';
import { AUDIENCE_LABELS, DIFFICULTY_LABELS, STRENGTH_LABELS } from './game.defaults.js';

const COMPARABLE_PRESETS = {
  difficulty: Object.keys(DIFFICULTY_LABELS),
  strength: Object.keys(STRENGTH_LABELS),
  audience: Object.keys(AUDIENCE_LABELS),
};

const duplicates = (ids) => ids.filter((id, i) => ids.indexOf(id) !== i);

export function genreProblems(genres = [], allowed = DEFAULT_GENRES) {
  const unknown = genres.filter((genre) => !allowed.includes(genre));
  return unknown.length
    ? [{ path: '/body/genres', message: `Unknown genres: ${unknown.join(', ')}` }]
    : [];
}

export function questionProblems(questions, path) {
  const problems = duplicates(questions.map((q) => q.id)).map((id) => ({
    path,
    message: `Question id ${id} is used more than once`,
  }));

  questions.forEach((q, i) => {
    const at = `${path}/${i}`;
    const optionLists = [q.options, q.grid?.rows, q.grid?.columns].filter(Boolean);
    for (const list of optionLists) {
      for (const id of duplicates(list.map((o) => o.id))) {
        problems.push({ path: at, message: `Option id ${id} is used more than once` });
      }
    }
    if (q.type === 'dropdown' && q.allowOther) {
      problems.push({ path: `${at}/allowOther`, message: 'Dropdowns cannot have an Other option' });
    }
    if (q.type === 'slider') {
      const { min, max, step, valueLabels } = q.slider;
      if (min >= max) problems.push({ path: `${at}/slider`, message: 'min must be below max' });
      else if (valueLabels && valueLabels.length !== Math.floor((max - min) / step) + 1) {
        problems.push({
          path: `${at}/slider/valueLabels`,
          message: 'Give one label per slider value',
        });
      }
    }
  });
  return problems;
}

export function normalizePresets(questions) {
  const seen = new Set();
  return questions.map(({ preset, ...question }) => {
    if (!preset || seen.has(preset)) return question;
    const allowed = COMPARABLE_PRESETS[preset];
    if (allowed) {
      const ids = question.options?.map((o) => o.id) ?? [];
      const unchanged =
        question.type === 'multiple_choice' &&
        ids.length === allowed.length &&
        allowed.every((id) => ids.includes(id));
      if (!unchanged) return question;
    }
    seen.add(preset);
    return { ...question, preset };
  });
}

export function missionProblems(missions, path) {
  return duplicates(missions.map((m) => m.id)).map((id) => ({
    path,
    message: `Mission id ${id} is used more than once`,
  }));
}

export function publishProblems(game) {
  const checks = [
    [!game.pitch, '/pitch', 'Add a one-line pitch'],
    [!game.genres.length, '/genres', 'Pick at least one genre'],
    [!game.platforms.length, '/platforms', 'Pick at least one platform'],
    [!game.buildStage, '/buildStage', 'Pick a build stage'],
    [!game.version, '/version', 'Add a version'],
    [!game.engine, '/engine', 'Pick what the game is built with'],
    [game.engine === 'other' && !game.engineOther, '/engineOther', 'Name the engine'],
    [!game.media.some((m) => m.type === 'image'), '/media', 'Add at least one screenshot'],
    [
      game.coreGameplay.length < 2 || game.coreGameplay.length > 4,
      '/coreGameplay',
      'Add 2–4 core gameplay points',
    ],
    [!game.playable.length, '/playable', "Add at least one point to What's playable"],
    [!game.form.playtest.missions.length, '/form/playtest/missions', 'Add at least one mission'],
    [!game.delivery.method, '/delivery/method', 'Choose how players get your game'],
    [
      game.delivery.method === 'web' &&
        !game.delivery.webUrl &&
        !(game.$locals.builds ?? []).some(
          (build) => build.target === 'web' && build.status === 'ready',
        ),
      '/delivery',
      'Upload a web build or add a link',
    ],
    [
      game.delivery.method === 'download' &&
        !(game.$locals.builds ?? []).some(
          (build) => build.target !== 'web' && build.status === 'ready',
        ),
      '/delivery',
      'Upload at least one download build',
    ],
  ];
  return checks.filter(([failed]) => failed).map(([, path, message]) => ({ path, message }));
}
