import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../../lib/api.js';
import { AppLayout } from '../../components/layout/AppLayout.jsx';
import { PageLookContext } from '../../components/layout/pageLook.js';
import { GamePage } from './GamePage.jsx';
import { GameEditorPage } from './GameEditorPage.jsx';
import { MyGameRedirect } from './MyGameRedirect.jsx';
import { readableText, themeLook } from './gameTheme.js';
import { problemSummary, publishProblems, fromGame } from './editorModel.js';

vi.mock('../../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const baseGame = {
  id: 'game-1',
  status: 'published',
  owner: { id: 'user-2', username: 'enola', displayName: 'Enola', avatarUrl: null },
  title: 'Tempest',
  pitch: 'Stranded after a plane crash on a storm-cursed island.',
  genres: ['survival'],
  platforms: ['web'],
  buildStage: 'prototype',
  version: '0.1',
  lastUpdatedAt: '2026-08-25T00:00:00Z',
  media: [{ id: 'media-1', type: 'image', url: 'https://cdn.test/tempest.jpg' }],
  contentWarnings: ['Flashing lights'],
  coreGameplay: ['Explore a stormy island', 'Scavenge to survive'],
  playable: ['The crash site'],
  controls: [{ key: 'WASD', action: 'Move' }],
  devNotes: 'Our first prototype!',
  engine: 'unreal',
  engineOther: null,
  credits: [{ role: 'Design & Programming', name: 'Stormglass Studio' }],
  theme: {
    backgroundPreset: 'storm',
    backgroundImageUrl: null,
    accentColor: '#FFD60A',
    controlsCardColor: '#9B7BFF',
  },
  delivery: { method: 'web', webUrl: 'https://play.test/tempest/', builds: [] },
  playtest: { missionCount: 3, estimatedMinutes: 30 },
  reviewCount: 24,
  isOwner: false,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-25T00:00:00Z',
  publishedAt: '2026-08-25T00:00:00Z',
};
const game = (overrides = {}) => structuredClone({ ...baseGame, ...overrides });

let current;
function mount(path, routes) {
  const router = createMemoryRouter(
    [
      { element: <AppLayout />, children: routes },
      { path: '/games/:gameId/review', element: <h1>Review flow</h1> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  current = game();
  api.get.mockImplementation(async (path) => {
    if (path === '/me') throw Object.assign(new Error('Unauthorized'), { status: 401 });
    if (path === '/meta') {
      return {
        genres: [
          { key: 'survival', label: 'Survival' },
          { key: 'mystery', label: 'Mystery' },
        ],
        platforms: ['web', 'pc', 'mac', 'mobile'],
        buildStages: ['prototype', 'alpha', 'beta', 'demo'],
      };
    }
    if (path === '/games/game-1') return structuredClone(current);
    throw new Error(`Unexpected GET ${path}`);
  });
  // PATCH /games/:id answers with the whole GameDetail.
  api.patch.mockImplementation(async (_, body) => {
    const next = structuredClone(current);
    return {
      ...next,
      ...body,
      theme: { ...next.theme, ...body.theme },
      delivery: { ...next.delivery, ...body.delivery },
    };
  });
});

describe('Game page', () => {
  it('shows the game in its theme and starts a review from Try our Game!', async () => {
    mount('/games/game-1', [{ path: '/games/:gameId', element: <GamePage /> }]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tempest' })).toBeInTheDocument();
    expect(screen.getByText('Platform: Web')).toBeInTheDocument();
    expect(screen.getByText('Unreal Engine')).toBeInTheDocument();
    expect(screen.getByText('last updated: 25.08.2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try our Game!' })).toHaveAttribute(
      'href',
      '/games/game-1/review',
    );
    expect(screen.getByRole('link', { name: 'Reviews & Discussion (24)' })).toHaveAttribute(
      'href',
      '/games/game-1/reviews',
    );
  });

  it('hands the game theme to the page shell', async () => {
    const setLook = vi.fn();
    const router = createMemoryRouter([{ path: '/games/:gameId', element: <GamePage /> }], {
      initialEntries: ['/games/game-1'],
    });
    render(
      <PageLookContext.Provider value={setLook}>
        <RouterProvider router={router} />
      </PageLookContext.Provider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Tempest' });
    const look = setLook.mock.calls.map(([value]) => value).find(Boolean);
    expect(look.dark).toBe(true);
    expect(look.style['--theme-accent']).toBe('#FFD60A');
    expect(look.style['--theme-on-accent']).toBe('#191923');
    expect(look.style.background).toContain('storm-clouds');
  });

  it('offers the owner Edit game instead of a review', async () => {
    current = game({ isOwner: true });
    mount('/games/game-1', [{ path: '/games/:gameId', element: <GamePage /> }]);
    expect(await screen.findByRole('link', { name: 'Edit game' })).toHaveAttribute(
      'href',
      '/my-games/game-1/edit',
    );
    expect(screen.queryByRole('link', { name: 'Try our Game!' })).not.toBeInTheDocument();
  });
});

describe('Game editor', () => {
  const editorRoutes = [
    { path: '/my-games/new', element: <GameEditorPage /> },
    { path: '/my-games/:gameId/edit', element: <GameEditorPage /> },
    { path: '/games/:gameId', element: <h1>Public page</h1> },
  ];

  it('starts a new game from its title', async () => {
    const u = userEvent.setup();
    api.post.mockResolvedValue({ id: 'game-9' });
    const router = mount('/my-games/new', editorRoutes);
    await u.type(screen.getByRole('textbox', { name: 'Game title' }), 'Undertow');
    await u.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(api.post).toHaveBeenCalledWith('/games', { title: 'Undertow' });
    expect(router.state.location.pathname).toBe('/my-games/game-9/edit');
  });

  it('lists what is missing and only publishes a complete draft', async () => {
    const u = userEvent.setup();
    current = game({ status: 'draft', isOwner: true, media: [], pitch: '' });
    mount('/my-games/game-1/edit', editorRoutes);
    const bar = await screen.findByText(/things left before you can publish/);
    expect(bar).toHaveTextContent('add a screenshot and add a one-line pitch');
    expect(screen.getByRole('button', { name: 'Publish Game' })).toBeDisabled();

    await u.type(screen.getByRole('textbox', { name: 'One-line pitch *' }), 'Dive for wreckage.');
    await u.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(api.patch).toHaveBeenCalledWith(
      '/games/game-1',
      expect.objectContaining({ pitch: 'Dive for wreckage.', genres: ['survival'] }),
    );
    expect(
      await screen.findByText(/1 thing left before you can publish: add a screenshot\./),
    ).toBeInTheDocument();
  });

  it('saves a published game only on Save changes and keeps its theme choices', async () => {
    const u = userEvent.setup();
    current = game({ isOwner: true });
    mount('/my-games/game-1/edit', editorRoutes);
    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    const accent = screen.getByRole('radiogroup', { name: 'Page accent' });
    await u.click(within(accent).getByRole('radio', { name: '#074CFC' }));
    await u.click(screen.getByRole('radio', { name: 'Night' }));
    await u.click(save);
    expect(api.patch).toHaveBeenCalledWith(
      '/games/game-1',
      expect.objectContaining({
        theme: { accentColor: '#074CFC', controlsCardColor: '#9B7BFF', backgroundPreset: 'night' },
      }),
    );
  });
});

describe('My game redirect', () => {
  it.each([
    ['draft', '/my-games/game-1/edit'],
    ['published', '/games/game-1'],
  ])('sends a %s game to %s', async (status, target) => {
    current = game({ status, isOwner: true });
    const router = mount('/my-games/game-1', [
      { path: '/my-games/:gameId', element: <MyGameRedirect /> },
      { path: '/my-games/:gameId/edit', element: <h1>Editor</h1> },
      { path: '/games/:gameId', element: <h1>Public page</h1> },
    ]);
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toBe(target);
  });
});

describe('Game theme and publish checks', () => {
  it('picks readable text and light or dark panels', () => {
    expect(readableText([255, 214, 10])).toBe('#191923');
    expect(readableText([7, 76, 252])).toBe('#ffffff');
    expect(themeLook({ backgroundPreset: 'sky' }).dark).toBe(false);
    expect(themeLook({ backgroundPreset: 'night' }).dark).toBe(true);
    expect(themeLook({ backgroundImageUrl: 'https://cdn.test/bg.jpg' }).style.background).toContain(
      'https://cdn.test/bg.jpg',
    );
  });

  it('mirrors the server publish checklist', () => {
    const draft = game({ media: [], playtest: { missionCount: 0, estimatedMinutes: 0 } });
    const problems = publishProblems(fromGame(draft), draft);
    expect(problems).toEqual(['add a screenshot', 'add a mission to your PlayLoop form']);
    expect(problemSummary(problems)).toBe(
      '2 things left before you can publish: add a screenshot and add a mission to your PlayLoop form.',
    );
  });
});
