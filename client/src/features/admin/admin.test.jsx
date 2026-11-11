import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../../lib/api.js';
import { routes } from '../../routes.jsx';
import { configPatch, configProblem } from './configModel.js';

vi.mock('../../lib/api.js', () => ({
  api: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const admin = { id: 'u-admin', username: 'ploy', displayName: 'Ploy', role: 'admin' };
const author = {
  id: 'u-ocean',
  username: 'oceanexplorer',
  displayName: 'OceanExplorer',
  avatarUrl: null,
  level: 8,
  levelTitle: 'Reviewer',
};
const reporter = (name) => ({ ...author, id: `u-${name}`, username: name, displayName: name });
const target = {
  type: 'review',
  id: 'rev-1',
  preview: 'Get free Steam keys at freekeys-now.net.',
  owner: author,
  hidden: false,
  removed: false,
  link: '/reviews/rev-1',
};
const report = (id, name, extra = {}) => ({
  id,
  reporter: reporter(name),
  target,
  reason: 'spam',
  details: null,
  status: 'open',
  reportCount: 2,
  createdAt: '2026-10-14T08:00:00.000Z',
  resolvedAt: null,
  resolutionNote: null,
  ...extra,
});
const reports = [
  report('rep-1', 'Kai', { details: 'It’s an ad for a key site.' }),
  report('rep-2', 'Mira'),
];
const adminUser = {
  ...author,
  email: 'ocean@example.com',
  role: 'user',
  status: 'active',
  reputationPoints: 1240,
  stats: { reviewsWritten: 24, gamesPublished: 0, helpfulVotes: 80 },
  openReportCount: 1,
  createdAt: '2026-06-02T00:00:00.000Z',
};
const gameCard = (id, title) => ({ id, title, genres: ['survival'], reviewCount: 12 });
const config = {
  genres: [
    { key: 'survival', label: 'Survival', active: true },
    { key: 'horror', label: 'Horror', active: true },
  ],
  levels: [
    { level: 1, title: 'Newcomer', minPoints: 0 },
    { level: 2, title: 'Playtester', minPoints: 100 },
  ],
  badges: [
    {
      key: 'first_review',
      name: 'First Review',
      description: 'Submit your first review.',
      kind: 'achievement',
      threshold: 1,
      active: true,
    },
  ],
  reputationPoints: { helpfulVote: 10, notHelpfulVote: -3, feedbackPlanned: 5, feedbackFixed: 15 },
  updatedAt: '2026-10-11T08:30:00.000Z',
};
const pageOf = (items) => ({ items, page: 1, limit: 10, total: items.length });

function mount(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

let me;
beforeEach(() => {
  vi.resetAllMocks();
  me = admin;
  api.get.mockImplementation(async (path) => {
    if (path === '/me') return me;
    if (path.startsWith('/admin/reports')) return pageOf(structuredClone(reports));
    if (path.startsWith('/admin/history')) return pageOf([]);
    if (path.startsWith('/admin/users/')) return structuredClone(adminUser);
    if (path === '/admin/featured') return { items: [gameCard('g-1', 'Tempest')] };
    if (path.startsWith('/admin/games'))
      return pageOf(
        [gameCard('g-1', 'Tempest'), gameCard('g-2', 'Tidebound')].map((game) => ({
          game,
          playtestCount: 300,
          openReportCount: 0,
          featured: game.id === 'g-1',
          lastActivityAt: '2026-10-11T08:30:00.000Z',
        })),
      );
    if (path === '/admin/config') return structuredClone(config);
    if (path.startsWith('/admin/stats'))
      return {
        totals: {
          users: 1248,
          suspendedUsers: 2,
          bannedUsers: 5,
          games: 100,
          publishedGames: 86,
          submittedReviews: 400,
          inProgressReviews: 20,
          replies: 90,
          openReports: 3,
        },
        daily: [
          { date: '2026-10-10', newUsers: 4, newGames: 1, submittedReviews: 9, reports: 0 },
          { date: '2026-10-11', newUsers: 6, newGames: 0, submittedReviews: 12, reports: 1 },
        ],
      };
    throw new Error(`Unexpected GET ${path}`);
  });
  api.patch.mockResolvedValue({});
  api.post.mockResolvedValue({});
  api.put.mockResolvedValue({});
});

describe('admin area', () => {
  it('keeps people without the admin role out', async () => {
    me = { ...admin, role: 'user' };
    mount('/admin');
    expect(await screen.findByText('This area is for admins')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/stats'),
      expect.anything(),
    );
  });

  it('shows the dashboard totals and the activity in the period', async () => {
    mount('/admin');
    expect(await screen.findByText('1,248')).toBeInTheDocument();
    expect(screen.getByText('+10 in the last 7 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Needs review' })).toHaveAttribute(
      'href',
      '/admin/reports',
    );
    expect(screen.getByRole('list', { name: 'New users per day' })).toBeInTheDocument();
  });

  it('opens a report from the queue', async () => {
    const user = userEvent.setup();
    const router = mount('/admin/reports');
    const rows = await screen.findAllByRole('button', { name: /Review: Get free Steam keys/ });
    expect(rows).toHaveLength(2);
    await user.click(screen.getByRole('link', { name: 'Open Moderation' }));
    expect(router.state.location.pathname).toBe('/admin/reports/rep-1');
    expect(await screen.findByText('Reports (2)')).toBeInTheDocument();
  });

  it('hides reported content with a reason and resolves every report on it', async () => {
    const user = userEvent.setup();
    mount('/admin/reports/rep-1');
    const hide = await screen.findByRole('button', { name: 'Hide' });
    expect(hide).toBeDisabled();
    await user.type(screen.getByLabelText('Reason, saved with the action'), 'Advertising');
    await user.click(hide);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/content/review/rev-1/hide', {
        reason: 'Advertising',
      }),
    );
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.patch).toHaveBeenCalledWith('/admin/reports/rep-2', {
      status: 'resolved',
      note: 'Advertising',
    });
    expect(await screen.findByText('Hidden, and the reports are resolved.')).toBeInTheDocument();
  });

  it('suspends a user for the chosen time', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ ...adminUser, status: 'suspended' });
    mount('/admin/users/u-ocean');
    await user.click(await screen.findByRole('button', { name: 'Suspend or ban' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspend or ban OceanExplorer' });
    const confirm = within(dialog).getByRole('button', { name: 'Suspend for 7 days' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Suspend 30 days'));
    await user.type(within(dialog).getByLabelText('Reason (the user sees this)'), 'Spam links');
    const before = Date.now();
    await user.click(within(dialog).getByRole('button', { name: 'Suspend for 30 days' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe('/admin/users/u-ocean/suspend');
    expect(body.reason).toBe('Spam links');
    const days = (new Date(body.until).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(await screen.findByText('OceanExplorer is suspended.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('bans with no end date', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ ...adminUser, status: 'banned' });
    mount('/admin/users/u-ocean');
    await user.click(await screen.findByRole('button', { name: 'Suspend or ban' }));
    await user.click(screen.getByLabelText('Ban'));
    await user.type(screen.getByLabelText('Reason (the user sees this)'), 'Repeat offender');
    await user.click(screen.getByRole('button', { name: 'Ban permanently' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/users/u-ocean/suspend', {
        reason: 'Repeat offender',
        until: null,
      }),
    );
  });

  it('adds a game to the end of the featured list', async () => {
    const user = userEvent.setup();
    mount('/admin/featured');
    await user.click(await screen.findByRole('button', { name: 'Feature Tidebound' }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/admin/featured', { gameIds: ['g-1', 'g-2'] }),
    );
  });

  it('saves only the configuration sections that changed', async () => {
    const user = userEvent.setup();
    api.patch.mockImplementation(async (_path, body) => ({ ...config, ...body }));
    mount('/admin/settings');
    const save = await screen.findByRole('button', { name: 'Save Changes' });
    expect(save).toBeDisabled();
    const points = screen.getByLabelText('Helpful vote on a review');
    await user.clear(points);
    await user.type(points, '12');
    await user.click(save);
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/config', {
        reputationPoints: { ...config.reputationPoints, helpfulVote: 12 },
      }),
    );
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });
});

describe('configuration rules', () => {
  it('sends nothing when nothing changed', () => {
    expect(configPatch(config, structuredClone(config))).toEqual({});
  });

  it('rejects levels that do not increase', () => {
    const draft = structuredClone(config);
    draft.levels[1].minPoints = 0;
    expect(configProblem(draft)).toBe('Each level must need more points than the one before.');
    expect(configProblem(config)).toBe('');
  });

  it('rejects an emptied number field', () => {
    const draft = structuredClone(config);
    draft.reputationPoints.helpfulVote = '';
    expect(configProblem(draft)).toBe('Reputation points must be whole numbers.');
  });
});
