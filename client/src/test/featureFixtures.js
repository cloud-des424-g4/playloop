// API-shaped test data; never imported by the application.
export const user = {
  id: 'user-1',
  username: 'kai',
  displayName: 'Kai',
  avatarUrl: null,
  level: 8,
};
export const game = {
  id: 'game-1',
  title: 'Tempest',
  pitch:
    'Stranded after a plane crash on a storm-cursed island, find a way to call for rescue before the lightning finds you.',
  status: 'published',
  buildStage: 'prototype',
  engine: 'unreal',
  platforms: ['pc'],
  genres: ['adventure'],
  coverUrl: '/src/dev/samples/breach-protocol-cover.webp',
  reviewCount: 12,
  newReviewCount: 3,
  updatedAt: '2026-10-11T00:00:00Z',
};
export const form = {
  gameId: game.id,
  revision: 1,
  firstImpression: {
    questions: [
      {
        id: 'q1',
        type: 'paragraph',
        title: 'What kind of game do you think this is?',
        required: true,
      },
      { id: 'q2', type: 'short_answer', title: 'What made you want to play?', required: true },
    ],
  },
  playtest: {
    missions: [
      { id: 'm1', title: 'Find the crash site radio', minutes: 5 },
      { id: 'm2', title: 'Reach the first research facility', minutes: 10 },
      { id: 'm3', title: 'Survive the Great Storm', minutes: 15 },
    ],
    knownIssues: ['Rain clips through the shelter roof.', 'No sound in the second facility yet.'],
    questions: [
      { id: 'd1', type: 'short_answer', title: 'Did the storms feel tense?', required: true },
    ],
  },
  finalVerdict: { farewellMessage: 'Thanks for playing!' },
};
export const review = {
  id: 'review-1',
  status: 'submitted',
  reviewer: user,
  game,
  form,
  feedbackStatus: 'new',
  submittedAt: '2026-10-11T00:00:00Z',
  firstImpression: {
    answers: [
      {
        questionId: 'q1',
        text: 'Looks like a survival game where you hide from lightning and search the island for a way out.',
      },
      { questionId: 'q2', text: 'The storm screenshots look great.' },
    ],
  },
  playtest: {
    playedSeconds: 2280,
    cards: [
      {
        id: 'c1',
        missionId: 'm1',
        type: 'enjoyed',
        comment: 'Found the radio fast. The lightning flash is great.',
      },
      {
        id: 'c2',
        missionId: 'm2',
        type: 'confused',
        comment: 'I walked past the door twice. It blends into the rocks.',
      },
      {
        id: 'c3',
        missionId: 'm3',
        type: 'bug',
        comment: 'The game froze when lightning hit the radio tower.',
      },
    ],
  },
  developerAnswers: {
    answers: [{ questionId: 'd1', text: 'Yes. The thunder made me run for cover every time.' }],
  },
  expectations: { difficulty: 'challenging', strength: 'visuals', audience: 'experienced' },
  finalVerdict: {
    comparison: 'different',
    changeText: 'It’s slower than I expected, but exploring the island was the best part.',
    actualDifficulty: 'moderate',
    actualStrength: 'audio',
    actualAudience: 'experienced',
    enjoyment: 4,
    improveText: 'Mark the facility entrances so they’re easier to spot.',
  },
  helpfulCount: 18,
  notHelpfulCount: 2,
  myVote: null,
  replyCount: 0,
  reactions: [],
  isReviewer: false,
  isGameOwner: true,
};
export const pageOf = (items, extra = {}) => ({
  items,
  page: 1,
  limit: 20,
  total: items.length,
  ...extra,
});
export const games = pageOf(
  [
    game,
    {
      ...game,
      id: 'game-2',
      title: 'Undertow',
      status: 'draft',
      engine: 'godot',
      pitch: 'Dive for wreckage along a flooded coast and surface before your air runs out.',
      coverUrl: null,
      reviewCount: 0,
      newReviewCount: 0,
    },
  ],
  { summary: { published: 1, drafts: 1, reviewsReceived: 12 } },
);
export const feedback = pageOf(
  [{ ...review, excerpt: 'Froze when lightning hit the tower. Loved exploring the island.' }],
  { counts: { all: 1, new: 1, reviewed: 0, planned: 0, fixed: 0 } },
);
export const notifications = pageOf(
  [
    {
      id: 'note-1',
      type: 'reply',
      read: false,
      message: 'Kai replied to your review of Tempest',
      link: '/reviews/review-1',
      reviewId: 'review-1',
      createdAt: '2026-10-11T00:00:00Z',
    },
  ],
  { unreadCount: 1 },
);
