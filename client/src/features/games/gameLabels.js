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
