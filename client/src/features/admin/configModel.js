const SECTIONS = ['genres', 'levels', 'badges', 'reputationPoints'];
export const GENRE_KEY = /^[a-z0-9_]{2,30}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const number = (value) => (value === '' ? '' : Number(value));

// What the API would reject, checked before saving so the admin sees which row is wrong.
export function configProblem(draft) {
  if (draft.genres.some((genre) => !genre.label.trim())) return 'Every genre needs a name.';
  const { levels } = draft;
  if (levels.some((level) => !level.title.trim())) return 'Every level needs a title.';
  if (levels.some((level) => !Number.isInteger(level.minPoints) || level.minPoints < 0))
    return 'Level points must be whole numbers, 0 or more.';
  if (levels[0].minPoints !== 0) return 'Level 1 must start at 0 points.';
  if (levels.some((level, index) => index > 0 && level.minPoints <= levels[index - 1].minPoints))
    return 'Each level must need more points than the one before.';
  if (draft.badges.some((badge) => !badge.name.trim() || !badge.description.trim()))
    return 'Every badge needs a name and a description.';
  if (
    draft.badges.some(
      (badge) =>
        badge.threshold !== null && (!Number.isInteger(badge.threshold) || badge.threshold < 1),
    )
  )
    return 'Badge thresholds must be whole numbers, 1 or more.';
  if (Object.values(draft.reputationPoints).some((points) => !Number.isInteger(points)))
    return 'Reputation points must be whole numbers.';
  return '';
}

// Only the sections that changed are sent; each one sent replaces that whole section.
export function configPatch(saved, draft) {
  return Object.fromEntries(
    SECTIONS.filter((key) => !same(saved[key], draft[key])).map((key) => [key, draft[key]]),
  );
}
