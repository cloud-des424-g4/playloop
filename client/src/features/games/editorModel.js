import { DEFAULT_THEME } from './gameTheme.js';

export const ENGINES = [
  ['unity', 'Unity'],
  ['unreal', 'Unreal'],
  ['godot', 'Godot'],
  ['gamemaker', 'GameMaker'],
  ['other', 'Other'],
];
export const BUILD_TARGETS = [
  ['windows', 'Windows'],
  ['mac', 'Mac'],
  ['linux', 'Linux'],
];
export const LIMITS = {
  title: 60,
  pitch: 120,
  genres: 5,
  warnings: 10,
  warning: 40,
  bullet: 120,
  core: 4,
  playable: 6,
  controls: 20,
  credits: 20,
  devNotes: 500,
  media: 8,
};

// Editable fields of a game (UpdateGameInput in docs/api schemas/game.yaml).
export function fromGame(game) {
  const theme = { ...DEFAULT_THEME, ...game.theme };
  return {
    title: game.title,
    pitch: game.pitch ?? '',
    genres: [...game.genres],
    platforms: [...game.platforms],
    buildStage: game.buildStage,
    version: game.version ?? '',
    contentWarnings: [...game.contentWarnings],
    coreGameplay: game.coreGameplay.length ? [...game.coreGameplay] : ['', ''],
    playable: game.playable.length ? [...game.playable] : [''],
    controls: game.controls.map((c) => ({ ...c })),
    devNotes: game.devNotes ?? '',
    engine: game.engine,
    engineOther: game.engineOther ?? '',
    credits: game.credits.map((c) => ({ ...c })),
    theme: {
      // null while a custom background image is in use.
      backgroundPreset: theme.backgroundImageUrl ? null : theme.backgroundPreset,
      accentColor: theme.accentColor,
      controlsCardColor: theme.controlsCardColor,
    },
    delivery: { method: game.delivery.method, webUrl: game.delivery.webUrl ?? '' },
  };
}

const filled = (list) => list.map((item) => item.trim()).filter(Boolean);

// What PATCH /games/:id gets. Empty optional fields are left out or cleared, never sent as "".
export function toPayload(form) {
  return {
    title: form.title.trim(),
    pitch: form.pitch.trim(),
    genres: form.genres,
    platforms: form.platforms,
    ...(form.buildStage && { buildStage: form.buildStage }),
    ...(form.version.trim() && { version: form.version.trim() }),
    contentWarnings: filled(form.contentWarnings),
    coreGameplay: filled(form.coreGameplay),
    playable: filled(form.playable),
    controls: form.controls
      .map((c) => ({ key: c.key.trim(), action: c.action.trim() }))
      .filter((c) => c.key && c.action),
    devNotes: form.devNotes.trim() || null,
    ...(form.engine && { engine: form.engine }),
    engineOther: form.engine === 'other' ? form.engineOther.trim() || null : null,
    credits: form.credits
      .map((c) => ({ role: c.role.trim(), name: c.name.trim() }))
      .filter((c) => c.role && c.name),
    theme: {
      accentColor: form.theme.accentColor,
      controlsCardColor: form.theme.controlsCardColor,
      ...(form.theme.backgroundPreset && { backgroundPreset: form.theme.backgroundPreset }),
    },
    delivery: {
      ...(form.delivery.method && { method: form.delivery.method }),
      webUrl: form.delivery.webUrl.trim() || null,
    },
  };
}

// Mirrors publishProblems() on the server so the publish bar can say what is missing.
export function publishProblems(form, game) {
  const builds = game.delivery.builds;
  const ready = (test) => builds.some((b) => test(b) && b.status === 'ready');
  const core = filled(form.coreGameplay).length;
  const checks = [
    [!game.media.some((m) => m.type === 'image'), 'add a screenshot'],
    [!form.pitch.trim(), 'add a one-line pitch'],
    [!form.genres.length, 'pick a genre tag'],
    [!form.platforms.length, 'pick a platform'],
    [!form.buildStage, 'pick a build stage'],
    [!form.version.trim(), 'add a version'],
    [!form.engine, 'pick what it’s built with'],
    [form.engine === 'other' && !form.engineOther.trim(), 'name the engine'],
    [core < 2 || core > 4, 'add 2–4 core gameplay points'],
    [!filled(form.playable).length, 'say what’s playable'],
    [!game.playtest.missionCount, 'add a mission to your PlayLoop form'],
    [!form.delivery.method, 'choose how players get your game'],
    [
      form.delivery.method === 'web' &&
        !form.delivery.webUrl.trim() &&
        !ready((b) => b.target === 'web'),
      'upload a web build or add a link',
    ],
    [
      form.delivery.method === 'download' && !ready((b) => b.target !== 'web'),
      'upload at least one download build',
    ],
  ];
  return checks.filter(([failed]) => failed).map(([, text]) => text);
}

export function problemSummary(problems) {
  if (!problems.length) return '';
  const count = `${problems.length} thing${problems.length === 1 ? '' : 's'}`;
  // The bar stays one or two lines: name two and count the rest.
  const shown =
    problems.length > 3 ? [...problems.slice(0, 2), `${problems.length - 2} more`] : problems;
  const list =
    shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
  return `${count} left before you can publish: ${list}.`;
}

export function savedText(savedAt, now) {
  if (!savedAt) return 'Not saved yet';
  const minutes = Math.floor((now - savedAt) / 60000);
  if (minutes < 1) return 'Saved just now';
  if (minutes < 60) return `Saved ${minutes} min ago`;
  return `Saved at ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
