import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../../lib/api.js';
import { ReviewLayout } from './ReviewLayout.jsx';
import { ReviewPage } from './ReviewPage.jsx';
import { canLeave } from './reviewModel.js';

vi.mock('../../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const impression = {
  id: 'impression',
  type: 'paragraph',
  title: 'What is your first impression of this game?',
  required: true,
  preset: 'impression',
};
const difficulty = {
  id: 'difficulty',
  type: 'multiple_choice',
  title: 'How difficult do you expect this game to be?',
  required: true,
  preset: 'difficulty',
  options: [
    { id: 'easy', label: 'Easy' },
    { id: 'challenging', label: 'Challenging' },
  ],
};
const devQuestions = [
  { id: 'dev-1', type: 'paragraph', title: 'Did the storms feel tense?', required: true },
  { id: 'dev-2', type: 'short_answer', title: 'Was it clear where to go?', required: false },
];

function makeReview(overrides = {}) {
  return {
    id: 'review-1',
    status: 'in_progress',
    deliveryMethod: 'web',
    currentStep: 'first_impression',
    game: {
      id: 'game-1',
      title: 'Tempest',
      pitch: 'Stranded on a storm-cursed island.',
      genres: ['survival'],
      controls: [{ key: 'WASD', action: 'Move' }],
      owner: { id: 'user-2', username: 'enola', displayName: 'Enola', avatarUrl: null },
      webPlayUrl: 'https://play.test/tempest/',
      downloads: [],
    },
    form: {
      firstImpression: { questions: [impression, difficulty] },
      playtest: {
        missions: [{ id: 'mission-1', title: 'Find the crash site radio', minutes: 5 }],
        knownIssues: ['Rain clips through the shelter roof.'],
        questions: devQuestions,
      },
      finalVerdict: { farewellMessage: 'Thanks for surviving the storm with us!' },
    },
    firstImpression: { answers: [] },
    playtest: { acceptedMissionIds: [], cards: [], playedSeconds: 0, proofScreenshotUrl: null },
    developerAnswers: { answers: [] },
    finalVerdict: {},
    expectations: {},
    ...overrides,
  };
}

function mount(review) {
  api.post.mockImplementation(async (path) => {
    if (path === '/games/game-1/reviews') return structuredClone(review);
    if (path.endsWith('/submit')) return { ...review, status: 'submitted' };
    throw new Error(`Unexpected POST ${path}`);
  });
  api.put.mockImplementation(async (_, body) => ({
    ...body,
    ...(body.complete && { completedAt: '2026-10-31T00:00:00Z' }),
  }));
  api.delete.mockResolvedValue(null);
  const router = createMemoryRouter(
    [
      {
        element: <ReviewLayout />,
        children: [{ path: '/games/:gameId/review', element: <ReviewPage /> }],
      },
      { path: '/games/:gameId', element: <h1>Game page</h1> },
      { path: '/reviews/:reviewId', element: <h1>Published review</h1> },
    ],
    { initialEntries: ['/games/game-1/review'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const leaveButton = () => screen.queryByRole('button', { name: 'Leave' });

beforeEach(() => vi.resetAllMocks());

describe('Review flow', () => {
  it('shows Leave only once the last First Impression question is reached', async () => {
    const u = userEvent.setup();
    mount(makeReview());
    const answer = await screen.findByRole('textbox', { name: impression.title });
    expect(leaveButton()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    await u.type(answer, 'Looks like a survival game.');
    await u.click(screen.getByRole('button', { name: 'Next' }));
    expect(api.put).toHaveBeenCalledWith('/reviews/review-1/first-impression', {
      answers: [{ questionId: 'impression', text: 'Looks like a survival game.' }],
      complete: false,
    });

    expect(await screen.findByRole('heading', { name: difficulty.title })).toBeInTheDocument();
    expect(leaveButton()).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: impression.title })).toBeInTheDocument();
    expect(leaveButton()).not.toBeInTheDocument();
  });

  it('requires an answer, then completes the First Impression and opens the playtest', async () => {
    const u = userEvent.setup();
    mount(
      makeReview({
        firstImpression: { answers: [{ questionId: 'impression', text: 'Stormy.' }] },
      }),
    );
    await u.click(await screen.findByRole('button', { name: 'Let’s Play!' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Answer this question to continue.');
    expect(api.put).not.toHaveBeenCalled();

    await u.click(screen.getByRole('radio', { name: 'Challenging' }));
    await u.click(screen.getByRole('button', { name: 'Let’s Play!' }));
    expect(api.put).toHaveBeenCalledWith('/reviews/review-1/first-impression', {
      answers: [
        { questionId: 'impression', text: 'Stormy.' },
        { questionId: 'difficulty', optionId: 'challenging' },
      ],
      complete: true,
    });
    expect(await screen.findByRole('heading', { name: 'Tempest', level: 1 })).toBeInTheDocument();
    expect(screen.getByTitle('Tempest game')).toHaveAttribute('src', 'https://play.test/tempest/');
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(leaveButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('shows Leave on the last developer question but not in the Final Verdict', async () => {
    const u = userEvent.setup();
    mount(
      makeReview({
        currentStep: 'developer_questions',
        firstImpression: { answers: [], completedAt: '2026-10-31T00:00:00Z' },
        playtest: {
          acceptedMissionIds: ['mission-1'],
          cards: [],
          playedSeconds: 600,
          proofScreenshotUrl: null,
          completedAt: '2026-10-31T00:00:00Z',
        },
      }),
    );
    await u.type(
      await screen.findByRole('textbox', { name: 'Did the storms feel tense?' }),
      'Yes.',
    );
    expect(leaveButton()).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('heading', { name: /Was it clear/ })).toBeInTheDocument();
    expect(leaveButton()).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Next' }));
    expect(api.put).toHaveBeenLastCalledWith('/reviews/review-1/developer-answers', {
      answers: [{ questionId: 'dev-1', text: 'Yes.' }],
      complete: true,
    });

    expect(await screen.findByText('Thanks for surviving the storm with us!')).toBeInTheDocument();
    expect(leaveButton()).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    await u.click(await screen.findByRole('button', { name: 'Start' }));
    expect(
      await screen.findByRole('heading', { name: 'YOUR FIRST IMPRESSION' }),
    ).toBeInTheDocument();
    expect(leaveButton()).not.toBeInTheDocument();
  });

  it('saves before leaving, or deletes the draft when discarded', async () => {
    const u = userEvent.setup();
    const oneQuestion = {
      form: { ...makeReview().form, firstImpression: { questions: [impression] } },
    };
    mount(makeReview(oneQuestion));
    await u.type(await screen.findByRole('textbox', { name: impression.title }), 'Stormy.');
    await u.click(screen.getByRole('button', { name: 'Leave' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Leave this review?' });
    await u.click(within(dialog).getByRole('button', { name: 'Save and leave' }));
    expect(api.put).toHaveBeenCalledWith('/reviews/review-1/first-impression', {
      answers: [{ questionId: 'impression', text: 'Stormy.' }],
      complete: false,
    });
    expect(await screen.findByRole('heading', { name: 'Game page' })).toBeInTheDocument();
  });

  it('discards the draft from the leave dialog', async () => {
    const u = userEvent.setup();
    mount(makeReview({ currentStep: 'summary' }));
    await u.click(await screen.findByRole('button', { name: 'Leave' }));
    await u.click(screen.getByRole('button', { name: 'Discard review' }));
    expect(api.delete).toHaveBeenCalledWith('/reviews/review-1');
    expect(await screen.findByRole('heading', { name: 'Game page' })).toBeInTheDocument();
  });

  it('submits from the summary and opens the published review', async () => {
    const u = userEvent.setup();
    mount(
      makeReview({
        currentStep: 'summary',
        firstImpression: {
          answers: [
            { questionId: 'impression', text: 'Stormy.' },
            { questionId: 'difficulty', optionId: 'challenging' },
          ],
        },
        finalVerdict: {
          comparison: 'different',
          changeText: 'Slower than expected.',
          enjoyment: 4,
          improveCategory: 'visuals',
          improveText: 'Mark the entrances.',
        },
      }),
    );
    expect(await screen.findByText('Stormy.')).toBeInTheDocument();
    expect(screen.getByText('Challenging')).toBeInTheDocument();
    expect(screen.getByText('A lot')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Submit Review' }));
    expect(api.post).toHaveBeenCalledWith('/reviews/review-1/submit');
    expect(await screen.findByRole('heading', { name: 'Published review' })).toBeInTheDocument();
  });
});

describe('canLeave', () => {
  const review = makeReview();
  it('follows the Figma frames', () => {
    expect(canLeave({ step: 'first_impression', index: 0 }, review)).toBe(false);
    expect(canLeave({ step: 'first_impression', index: 1 }, review)).toBe(true);
    expect(canLeave({ step: 'playtest' }, review)).toBe(true);
    expect(canLeave({ step: 'developer_questions', index: 0 }, review)).toBe(false);
    expect(canLeave({ step: 'developer_questions', index: 1 }, review)).toBe(true);
    for (const index of ['farewell', 'intro', 1, 2, 3, 4]) {
      expect(canLeave({ step: 'final_verdict', index }, review)).toBe(false);
    }
    expect(canLeave({ step: 'summary' }, review)).toBe(true);
  });
});
