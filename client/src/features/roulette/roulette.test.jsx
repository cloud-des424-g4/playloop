import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../../lib/api.js';
import { RoulettePage } from './RoulettePage.jsx';

vi.mock('../../lib/api.js', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const spinResult = (id) => ({
  spinToken: `token-${id}`,
  game: {
    id,
    title: id === 'game-1' ? 'Tempest' : 'Tidebound',
    pitch: 'Stranded on a storm-cursed island.',
    coverUrl: null,
    genres: ['survival'],
    platforms: ['web'],
    buildStage: 'prototype',
    engine: 'unreal',
    deliveryMethod: 'web',
    missionCount: 3,
    estimatedMinutes: 30,
    owner: { id: 'user-2', username: 'enola', displayName: 'Enola', avatarUrl: null },
  },
});

function mount() {
  const router = createMemoryRouter(
    [
      { path: '/roulette', element: <RoulettePage /> },
      { path: '/games/:gameId/review', element: <h1>Review flow</h1> },
    ],
    { initialEntries: ['/roulette'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({
    genres: [
      { key: 'rpg', label: 'RPG' },
      { key: 'survival', label: 'Survival' },
    ],
    platforms: ['web', 'pc'],
    buildStages: ['prototype', 'alpha'],
  });
});

describe('Playtest Roulette', () => {
  it('spins with the picked preferences and starts the playtest', async () => {
    const u = userEvent.setup();
    api.post.mockImplementation(async (path, body) => {
      if (path === '/roulette/spin') return spinResult(body.exclude ? 'game-2' : 'game-1');
      if (path === '/roulette/accept') return { id: 'review-1' };
      throw new Error(`Unexpected POST ${path}`);
    });
    const router = mount();
    await u.click(await screen.findByRole('button', { name: 'RPG' }));
    await u.click(screen.getByRole('button', { name: 'Web' }));
    await u.click(screen.getByRole('button', { name: 'Alpha' }));
    await u.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(screen.getByRole('button', { name: 'RPG' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: 'Spin' }));
    expect(api.post).toHaveBeenCalledWith('/roulette/spin', { genres: ['rpg'], platform: 'web' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Tempest' })).toBeInTheDocument();
    expect(screen.getByText('Platform: Web, plays in your browser')).toBeInTheDocument();
    expect(screen.getByText('Playtest: 3 missions, about 30 min')).toBeInTheDocument();
    expect(screen.getByText('Made by Enola')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Spin again' }));
    expect(api.post).toHaveBeenLastCalledWith('/roulette/spin', {
      genres: ['rpg'],
      platform: 'web',
      exclude: ['game-1'],
    });
    expect(await screen.findByRole('heading', { level: 2, name: 'Tidebound' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Start playtest' }));
    expect(api.post).toHaveBeenLastCalledWith('/roulette/accept', { spinToken: 'token-game-2' });
    expect(await screen.findByRole('heading', { name: 'Review flow' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/games/game-2/review');
  });

  it('says when nothing matches and keeps the preferences', async () => {
    const u = userEvent.setup();
    api.post.mockRejectedValue({ status: 404, code: 'NO_MATCH', message: 'No match' });
    mount();
    await u.click(await screen.findByRole('button', { name: 'Survival' }));
    await u.click(screen.getByRole('button', { name: 'Spin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No game matches these preferences yet. Try fewer filters.',
    );
    expect(screen.getByRole('button', { name: 'Survival' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('asks a signed-out visitor to log in', async () => {
    const u = userEvent.setup();
    api.post.mockRejectedValue({ status: 401, message: 'Please log in' });
    mount();
    await u.click(await screen.findByRole('button', { name: 'Spin the wheel' }));
    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});
