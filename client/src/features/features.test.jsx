import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../lib/api.js';
import { MyGamesPage } from './games/MyGamesPage.jsx';
import { FormBuilderPage } from './forms/FormBuilderPage.jsx';
import { FeedbackInboxPage } from './feedback/FeedbackInboxPage.jsx';
import { ReviewsPage } from './reviews/ReviewsPage.jsx';
import { NotificationBell } from './notifications/NotificationBell.jsx';
import { changeType, formPayload, validateForm } from './forms/formModel.js';
import {
  feedback,
  form,
  game,
  games,
  notifications,
  pageOf,
  review,
  user,
} from '../test/featureFixtures.js';
vi.mock('../lib/api.js', () => ({
  api: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
function mount(element, path = '/', route = path) {
  const router = createMemoryRouter(
    [
      { path: route, element },
      { path: '/reviews/:reviewId', element: <h1>Review destination</h1> },
      { path: '/my-games', element: <h1>Games destination</h1> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation(async (path) => {
    if (path.includes('/unread-count')) return { count: 1 };
    if (path.includes('/notifications')) return structuredClone(notifications);
    if (path.includes('/me/games')) return structuredClone(games);
    if (path.endsWith('/form')) return structuredClone(form);
    if (path.includes('/feedback')) return structuredClone(feedback);
    if (path.includes('/replies')) return pageOf([]);
    if (path.startsWith('/reviews/')) return structuredClone(review);
    if (path.includes('/reviews?')) return pageOf([structuredClone(review)]);
    return structuredClone(game);
  });
});
afterEach(cleanup);
describe('My Games', () => {
  it('uses server summary counts and links to the correct game workspace', async () => {
    mount(<MyGamesPage />);
    expect(await screen.findByText('12 reviews received')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Feedback inbox' })[0]).toHaveAttribute(
      'href',
      '/my-games/game-1/feedback',
    );
    expect(screen.getByRole('link', { name: 'Continue editing' })).toHaveAttribute(
      'href',
      '/my-games/game-2/edit',
    );
    expect(screen.getByText('No screenshots yet')).toBeInTheDocument();
  });
  it('shows an actionable login state without fabricated games', async () => {
    api.get.mockRejectedValue({ status: 401, message: 'Unauthorized' });
    mount(<MyGamesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Log in');
    expect(screen.queryByText('Tempest')).not.toBeInTheDocument();
  });
});
describe('Form builder', () => {
  it('keeps edits across tabs and saves all three sections without response metadata', async () => {
    const u = userEvent.setup();
    api.patch.mockImplementation(async (_, body) => ({ ...body, revision: 2 }));
    mount(<FormBuilderPage />, '/my-games/game-1/form', '/my-games/:gameId/form');
    const question = (await screen.findAllByLabelText('Question'))[0];
    await u.clear(question);
    await u.type(question, 'What caught your eye?');
    await u.click(screen.getByRole('tab', { name: '03 Final Verdict' }));
    await u.clear(screen.getByLabelText('Farewell message'));
    await u.type(screen.getByLabelText('Farewell message'), 'Thank you, explorer!');
    await u.click(screen.getByRole('button', { name: 'Save form' }));
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    const payload = api.patch.mock.calls[0][1];
    expect(payload.firstImpression.questions[0].title).toBe('What caught your eye?');
    expect(payload.finalVerdict.farewellMessage).toBe('Thank you, explorer!');
    expect(payload).not.toHaveProperty('revision');
    expect(payload.playtest.missions).toHaveLength(3);
  });
  it('validates hidden sections and preserves edits after save failure', async () => {
    const u = userEvent.setup();
    api.patch.mockRejectedValue(new Error('Connection lost'));
    mount(<FormBuilderPage />, '/my-games/game-1/form', '/my-games/:gameId/form');
    await u.click(await screen.findByRole('button', { name: '+ Add a question' }));
    await u.click(screen.getByRole('tab', { name: '02 Playtest' }));
    await u.click(screen.getByRole('button', { name: 'Save form' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('First Impression, question 3');
    expect(api.patch).not.toHaveBeenCalled();
    await u.click(screen.getByRole('tab', { name: '01 First Impression' }));
    await u.type(screen.getAllByLabelText('Question')[2], 'New question');
    await u.click(screen.getByRole('button', { name: 'Save form' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
    expect(screen.getAllByLabelText('Question')[2]).toHaveValue('New question');
  });
  it('confirms navigation away from a dirty form', async () => {
    const u = userEvent.setup();
    mount(<FormBuilderPage />, '/my-games/game-1/form', '/my-games/:gameId/form');
    await u.type((await screen.findAllByLabelText('Question'))[0], '!');
    await u.click(screen.getByRole('link', { name: 'My Games' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  it('removes incompatible question settings and validates mission durations', () => {
    expect(
      changeType({ ...form.firstImpression.questions[0], preset: 'impression' }, 'multiple_choice'),
    ).toMatchObject({ type: 'multiple_choice', options: expect.any(Array) });
    expect(
      changeType({ ...form.firstImpression.questions[0], options: [] }, 'rating'),
    ).not.toHaveProperty('options');
    const invalid = structuredClone(form);
    invalid.playtest.missions[0].minutes = 0;
    expect(validateForm(invalid)).toContain('1 to 600');
    expect(Object.keys(formPayload(form))).toHaveLength(3);
  });
});
it('saves feedback status using the documented PUT contract', async () => {
  api.put.mockResolvedValue({ feedbackStatus: 'planned' });
  const u = userEvent.setup();
  mount(<FeedbackInboxPage />, '/my-games/game-1/feedback', '/my-games/:gameId/feedback');
  await u.click(await screen.findByRole('button', { name: 'Planned', exact: true }));
  expect(api.put).toHaveBeenCalledWith('/reviews/review-1/feedback-status', { status: 'planned' });
});
it('votes, removes a vote, and posts a trimmed discussion reply', async () => {
  const u = userEvent.setup();
  api.put.mockResolvedValue({ helpfulCount: 19, notHelpfulCount: 2, myVote: 1 });
  api.delete.mockResolvedValue({ helpfulCount: 18, notHelpfulCount: 2, myVote: null });
  api.post.mockResolvedValue({});
  mount(<ReviewsPage />, '/games/game-1/reviews', '/games/:gameId/reviews');
  await u.click(await screen.findByRole('button', { name: 'Helpful (18)', exact: true }));
  expect(await screen.findByRole('button', { name: 'Helpful (19)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await u.click(screen.getByRole('button', { name: 'Helpful (19)', exact: true }));
  expect(api.delete).toHaveBeenCalledWith('/reviews/review-1/vote');
  await u.click(screen.getByRole('button', { name: 'Discussion', exact: true }));
  await u.type(screen.getByLabelText('Write a comment'), '  Great update!  ');
  await u.click(screen.getByRole('button', { name: 'Post Comment' }));
  expect(api.post).toHaveBeenCalledWith('/reviews/review-1/replies', { body: 'Great update!' });
  expect(await screen.findByText('Your reply was posted.')).toBeInTheDocument();
});
it('keeps an unsent reply when the server rejects it', async () => {
  const u = userEvent.setup();
  api.post.mockRejectedValue(new Error('Please try again'));
  mount(<ReviewsPage />, '/games/game-1/reviews', '/games/:gameId/reviews');
  await u.click(await screen.findByRole('button', { name: 'Discussion', exact: true }));
  await u.type(screen.getByLabelText('Write a comment'), 'My feedback');
  await u.click(screen.getByRole('button', { name: 'Post Comment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
  expect(screen.getByLabelText('Write a comment')).toHaveValue('My feedback');
});
it('marks a notification read before navigating and restores focus on Escape', async () => {
  const u = userEvent.setup();
  api.post.mockResolvedValue(null);
  mount(<NotificationBell user={user} />);
  await u.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  await screen.findByText('Kai replied to your review of Tempest');
  await u.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toHaveFocus();
  await u.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
  await u.click(await screen.findByRole('button', { name: /Kai replied/ }));
  expect(api.post).toHaveBeenCalledWith('/me/notifications/note-1/read');
  expect(await screen.findByRole('heading', { name: 'Review destination' })).toBeInTheDocument();
});
it('keeps notifications open with an error when marking all as read fails', async () => {
  const u = userEvent.setup();
  api.post.mockRejectedValue(new Error('Connection lost'));
  mount(<NotificationBell user={user} />);
  await u.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  await screen.findByText('Kai replied to your review of Tempest');
  await u.click(screen.getByRole('button', { name: 'Mark all as read' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  expect(
    within(screen.getByRole('region', { name: 'Notifications' })).getByText(/Kai replied/),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeEnabled(),
  );
});
