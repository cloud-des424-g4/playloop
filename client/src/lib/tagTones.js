// Tag tones are instance overrides in Figma, not variants. These are the pairings the
// high-fidelity screens use; anything unlisted (engines, platforms, build stages) is neutral.
export const TAG_TONES = ['neutral', 'blue', 'sky', 'lilac', 'lime', 'sunny', 'orange', 'pink'];

const GENRE_TONES = {
  action: 'orange',
  adventure: 'sky',
  exploration: 'sky',
  fantasy: 'lilac',
  mystery: 'lilac',
  horror: 'pink',
  racing: 'sunny',
  rpg: 'blue',
  shooter: 'orange',
  survival: 'lime',
};

export function toneForGenre(genre) {
  return GENRE_TONES[genre?.toLowerCase()] ?? 'neutral';
}

// Review card types from @playloop/shared CARD_TYPES.
export const REACTIONS = {
  enjoyed: { label: 'Enjoyed It', tone: 'lime' },
  confused: { label: 'Confused', tone: 'lilac' },
  bug: { label: 'Found a Bug', tone: 'pink' },
};
