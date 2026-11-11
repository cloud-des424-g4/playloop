import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../../lib/api.js';
import { ExplorePage } from './ExplorePage.jsx';
import { gamesPath, toggleFilter } from './exploreQuery.js';

vi.mock('../../lib/api.js', () => ({ api: { get: vi.fn() } }));

const card = (overrides) => ({
  coverUrl: null,
  platforms: ['web'],
  buildStage: 'alpha',
  estimatedMinutes: 10,
  reviewCount: 0,
  owner: { id: 'user-1', username: 'kai', displayName: 'Kai', avatarUrl: null },
  publishedAt: '2026-10-30T00:00:00Z',
  ...overrides,
});
const rune = card({
  id: 'game-1',
  title: 'Rune Rebellion',
  pitch: 'Master forbidden magic.',
  genres: ['rpg'],
  engine: 'godot',
});
const frequency = card({
  id: 'game-2',
  title: 'Dead Frequency',
  pitch: 'Follow mysterious radio signals.',
  genres: ['horror'],
  engine: 'unity',
});
const meta = {
  genres: [
    { key: 'horror', label: 'Horror' },
    { key: 'rpg', label: 'RPG' },
  ],
  platforms: ['web', 'pc'],
  buildStages: ['prototype', 'alpha'],
};

let gameResults;
function mount(path = '/') {
  const router = createMemoryRouter([{ path: '/', element: <ExplorePage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}
const gameRequests = () =>
  api.get.mock.calls.map(([path]) => path).filter((path) => path.startsWith('/games?'));

beforeEach(() => {
  vi.resetAllMocks();
  gameResults = [rune, frequency];
  api.get.mockImplementation(async (path) => {
    if (path.startsWith('/games?')) {
      return { items: gameResults, page: 1, limit: 12, total: gameResults.length };
    }
    if (path.startsWith('/recommendations')) return { items: [frequency] };
    if (path === '/meta') return meta;
    if (path === '/me') return { username: 'kai', favoriteGenres: ['horror'] };
    throw new Error(`Unexpected request ${path}`);
  });
});

describe('Explore Games', () => {
  it('lists published games with their tags and personalised recommendations', async () => {
    mount();
    const game = await screen.findByRole('link', { name: /Rune Rebellion/ });
    expect(game).toHaveAttribute('href', '/games/game-1');
    expect(within(game).getByText('RPG')).toBeInTheDocument();
    expect(within(game).getByText('Godot')).toBeInTheDocument();
    expect(within(game).getByText('Web')).toBeInTheDocument();
    expect(gameRequests()).toEqual(['/games?sort=newest&page=1&limit=12']);

    const recommendations = screen.getByRole('region', { name: 'Recommendations' });
    expect(
      await within(recommendations).findByRole('link', { name: /Dead Frequency/ }),
    ).toHaveTextContent('Horror - Unity');

    const top = screen.getByRole('list', { name: 'Your Top Categories' });
    expect(within(top).getByRole('button', { name: 'Horror' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toBeDisabled();
  });

  it('keeps sort, filters and search in the URL and requests matching games', async () => {
    const u = userEvent.setup();
    const router = mount();
    await screen.findByRole('link', { name: /Rune Rebellion/ });

    await u.click(screen.getByRole('tab', { name: 'Popular' }));
    expect(screen.getByRole('tab', { name: 'Popular' })).toHaveAttribute('aria-selected', 'true');

    const all = screen.getByRole('list', { name: 'All Genres & Themes' });
    await u.click(within(all).getByRole('button', { name: 'Horror' }));
    for (const chip of screen.getAllByRole('button', { name: 'Horror' })) {
      expect(chip).toHaveAttribute('aria-pressed', 'true');
    }

    await u.type(screen.getByRole('searchbox', { name: 'Search games' }), 'dead{Enter}');
    expect(router.state.location.search).toBe('?sort=popular&genre=horror&search=dead');
    expect(gameRequests().at(-1)).toBe(
      '/games?search=dead&genre=horror&sort=popular&page=1&limit=12',
    );
  });

  it('offers to clear filters when nothing matches', async () => {
    const u = userEvent.setup();
    gameResults = [];
    const router = mount('/?sort=popular&platform=pc&search=zzz');
    await u.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(router.state.location.search).toBe('?sort=popular');
    expect(screen.getByRole('searchbox', { name: 'Search games' })).toHaveValue('');
  });

  it('falls back to the shared option lists when /meta fails', async () => {
    const get = api.get.getMockImplementation();
    api.get.mockImplementation(async (path) => {
      if (path === '/meta') throw new Error('Unavailable');
      return get(path);
    });
    mount();
    const all = await screen.findByRole('list', { name: 'All Genres & Themes' });
    expect(within(all).getByRole('button', { name: 'Survival' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demo' })).toBeInTheDocument();
  });
});

describe('Explore query', () => {
  it('builds GET /games paths and resets paging when a filter changes', () => {
    const params = new URLSearchParams('genre=rpg&page=3&search=%20rune%20&foo=bar');
    expect(gamesPath(params)).toBe('/games?search=rune&genre=rpg&sort=newest&page=3&limit=12');
    const toggled = toggleFilter(params, 'genre', 'rpg');
    expect(toggled.has('page')).toBe(false);
    expect(toggled.getAll('genre')).toEqual([]);
    expect(toggleFilter(toggled, 'genre', 'horror').getAll('genre')).toEqual(['horror']);
  });
});
