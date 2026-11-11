import { BUILD_STAGES, DEFAULT_GENRES, PLATFORMS } from '@playloop/shared';
import { label } from '../shared/format.js';

// Browse state lives in the page URL under the same names GET /games uses, so a filtered view can
// be shared or bookmarked and the request is built straight from it.
export const FILTERS = ['genre', 'platform', 'buildStage'];
export const SORTS = ['newest', 'popular'];
export const PAGE_SIZE = 12;

export function sortOf(params) {
  return SORTS.includes(params.get('sort')) ? params.get('sort') : 'newest';
}

export function pageOf(params) {
  const page = Number.parseInt(params.get('page'), 10);
  return page > 0 ? page : 1;
}

export function hasFilters(params) {
  return Boolean(params.get('search')) || FILTERS.some((name) => params.has(name));
}

export function gamesPath(params) {
  const query = new URLSearchParams();
  const search = params.get('search')?.trim();
  if (search) query.set('search', search);
  for (const name of FILTERS) {
    for (const value of params.getAll(name)) query.append(name, value);
  }
  query.set('sort', sortOf(params));
  query.set('page', String(pageOf(params)));
  query.set('limit', String(PAGE_SIZE));
  return `/games?${query}`;
}

// Returns new params. Any change other than paging starts again from page 1.
export function withParam(params, name, value) {
  const next = new URLSearchParams(params);
  if (name !== 'page') next.delete('page');
  if (value) next.set(name, value);
  else next.delete(name);
  return next;
}

export function toggleFilter(params, name, value) {
  const values = params.getAll(name);
  const next = new URLSearchParams(params);
  next.delete('page');
  next.delete(name);
  const kept = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  for (const v of kept) next.append(name, v);
  return next;
}

export function clearFilters(params) {
  const next = new URLSearchParams();
  if (params.has('sort')) next.set('sort', sortOf(params));
  return next;
}

const SPECIAL_LABELS = { pc: 'PC', rpg: 'RPG', gamemaker: 'GameMaker' };

export function optionLabel(value) {
  return SPECIAL_LABELS[value] ?? label(value);
}

// Option lists come from GET /meta (genres are admin-configured). If it fails, fall back to the
// shared defaults so the filters still work.
export const FALLBACK_OPTIONS = {
  genres: DEFAULT_GENRES.map((key) => ({ key, label: optionLabel(key) })),
  platforms: PLATFORMS,
  buildStages: BUILD_STAGES,
};
