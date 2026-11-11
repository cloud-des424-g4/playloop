import { toneForGenre } from '../../lib/tagTones.js';
import { optionLabel } from '../explore/exploreQuery.js';

const ENGINE_NAMES = {
  unity: 'Unity',
  unreal: 'Unreal Engine',
  godot: 'Godot',
  gamemaker: 'GameMaker',
};

export const engineLabel = (game) =>
  game.engine === 'other' ? game.engineOther || 'Other' : (ENGINE_NAMES[game.engine] ?? '');

export const platformText = (platforms) => platforms.map(optionLabel).join(', ');

// Figma writes dates as 25.08.2026.
export function updatedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

// Tags on a game card: the first genre in its tone, the engine, then platforms (Figma 178:230).
export function cardTags(game, genreLabel = optionLabel) {
  const [genre] = game.genres;
  return [
    ...(genre ? [{ label: genreLabel(genre), tone: toneForGenre(genre) }] : []),
    ...(game.engine ? [{ label: optionLabel(game.engine) }] : []),
    ...game.platforms.map((platform) => ({ label: optionLabel(platform) })),
  ];
}
