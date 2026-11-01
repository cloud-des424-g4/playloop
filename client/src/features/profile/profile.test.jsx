import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../../lib/api.js';
import { ProfilePage } from './ProfilePage.jsx';
import { EditProfilePage } from './EditProfilePage.jsx';

vi.mock('../../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const profile = {
  id: 'user-2',
  username: 'enolaholmes',
  displayName: 'Enola',
  pronouns: 'she/her',
  bio: 'Indie dev making stormy games.',
  avatarUrl: null,
  favoriteGenres: ['survival'],
  platforms: ['pc'],
  links: [{ label: 'Website', url: 'https://www.enola.games/' }],
  joinedAt: '2026-01-01T00:00:00Z',
  reputation: {
    points: 1240,
    level: 4,
    title: 'Critic',
    levelMinPoints: 1000,
    nextLevelMinPoints: 1500,
  },
  badges: [
    {
      key: 'first_launch',
      name: 'First Launch',
      description: 'Published your first game',
      kind: 'achievement',
    },
  ],
  stats: { reviewsWritten: 3, gamesPublished: 1, helpfulVotes: 84 },
  isMe: false,
};
const game = {
  id: 'game-1',
  title: 'Tempest',
  pitch: 'Explore a storm-cursed island.',
  coverUrl: null,
  genres: ['survival'],
  platforms: ['web'],
  engine: 'unreal',
};
const review = (n) => ({
  id: `review-${n}`,
  game: { id: `game-${n}`, title: `Game ${n}`, coverUrl: null, deleted: false },
  excerpt: `Review ${n} excerpt.`,
  helpfulCount: n,
  submittedAt: '2026-10-10T00:00:00Z',
});

function mount(path, routes) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

let me;
beforeEach(() => {
  vi.resetAllMocks();
  me = { ...structuredClone(profile), email: 'enola@playloop.test', role: 'user', isMe: true };
  api.get.mockImplementation(async (path) => {
    if (path === '/users/enolaholmes') return structuredClone(profile);
    if (path.startsWith('/users/enolaholmes/games')) {
      return { items: [game], page: 1, limit: 6, total: 1 };
    }
    if (path.startsWith('/users/enolaholmes/reviews')) {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return { items: [review(page)], page, limit: 6, total: 2 };
    }
    if (path === '/me') return structuredClone(me);
    if (path === '/meta') {
      return {
        genres: [
          { key: 'survival', label: 'Survival' },
          { key: 'rpg', label: 'RPG' },
        ],
        platforms: ['web', 'pc', 'mac', 'mobile'],
        buildStages: ['alpha'],
      };
    }
    throw new Error(`Unexpected GET ${path}`);
  });
});

describe('Public profile', () => {
  it('shows the header, badges and published games', async () => {
    mount('/users/enolaholmes', [{ path: '/users/:username', element: <ProfilePage /> }]);
    expect(await screen.findByRole('heading', { name: 'Enola' })).toBeInTheDocument();
    expect(screen.getByText('Lv 4 · Critic')).toBeInTheDocument();
    expect(screen.getByText('1,240 / 1,500 pts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'enola.games ↗' })).toHaveAttribute(
      'href',
      'https://www.enola.games/',
    );
    expect(screen.getByText('First Launch')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Tempest/ })).toHaveAttribute(
      'href',
      '/games/game-1',
    );
    expect(screen.getByText('1 game')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit Profile' })).not.toBeInTheDocument();
  });

  it('switches to reviews in the URL and loads more on request', async () => {
    const u = userEvent.setup();
    const router = mount('/users/enolaholmes', [
      { path: '/users/:username', element: <ProfilePage /> },
    ]);
    await u.click(await screen.findByRole('tab', { name: 'Reviews' }));
    expect(router.state.location.search).toBe('?tab=reviews');
    expect(await screen.findByText('Review 1 excerpt.')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2 reviews')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Load more reviews' }));
    expect(await screen.findByText('Review 2 excerpt.')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 2 reviews')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more reviews' })).not.toBeInTheDocument();
  });

  it('offers Edit Profile on your own profile', async () => {
    api.get.mockImplementation(async (path) => {
      if (path === '/users/enolaholmes') return { ...structuredClone(profile), isMe: true };
      return { items: [], page: 1, limit: 6, total: 0 };
    });
    mount('/users/enolaholmes', [{ path: '/users/:username', element: <ProfilePage /> }]);
    expect(await screen.findByRole('link', { name: 'Edit Profile' })).toHaveAttribute(
      'href',
      '/settings/profile',
    );
    expect(await screen.findByText('No published games yet.')).toBeInTheDocument();
  });
});

describe('Edit profile', () => {
  it('keeps the username read-only and saves the profile', async () => {
    const u = userEvent.setup();
    api.patch.mockResolvedValue({});
    const router = mount('/settings/profile', [
      { path: '/settings/profile', element: <EditProfilePage /> },
      { path: '/users/:username', element: <h1>Profile page</h1> },
    ]);
    const username = await screen.findByRole('textbox', { name: 'Username' });
    expect(username).toHaveAttribute('readonly');
    expect(username).toHaveValue('@enolaholmes');

    const name = screen.getByRole('textbox', { name: 'Display name' });
    await u.clear(name);
    await u.type(name, 'Enola H.');
    await u.selectOptions(screen.getByRole('combobox', { name: 'Add genre' }), 'rpg');
    const platforms = screen.getByRole('group', { name: 'Platforms' });
    await u.click(within(platforms).getByRole('checkbox', { name: 'Mac' }));
    await u.click(screen.getByRole('button', { name: 'Remove link 1' }));
    await u.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/me', {
      displayName: 'Enola H.',
      pronouns: 'she/her',
      bio: 'Indie dev making stormy games.',
      favoriteGenres: ['survival', 'rpg'],
      platforms: ['pc', 'mac'],
      links: [],
    });
    expect(await screen.findByRole('heading', { name: 'Profile page' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/users/enolaholmes');
  });
});
