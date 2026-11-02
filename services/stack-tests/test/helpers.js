import { User } from '../../community/src/modules/users/user.model.js';
import { Game } from '../../community/src/modules/games/game.model.js';
import { Review } from '../../community/src/modules/reviews/review.model.js';
import { defaultForm } from '../../community/src/modules/games/game.defaults.js';
import { SESSION_COOKIE, signSessionToken } from '../../community/src/middleware/auth.js';

let count = 0;

export function createUser(overrides = {}) {
  count += 1;
  return User.create({
    username: `user${count}`,
    email: `user${count}@example.com`,
    passwordHash: 'not-a-real-hash',
    ...overrides,
  });
}

export const authCookie = (user) => `${SESSION_COOKIE}=${signSessionToken(user)}`;

export function createPublishedGame(owner, overrides = {}) {
  const form = defaultForm();
  form.playtest = {
    missions: [
      { id: 'm1', title: 'Find the crash site radio', minutes: 5 },
      { id: 'm2', title: 'Reach the research facility', minutes: 10 },
    ],
    knownIssues: ['Rain clips through the shelter roof.'],
    questions: [
      { id: 'dq1', type: 'paragraph', title: 'Did the storms feel tense?', required: true },
    ],
  };
  return Game.create({
    owner: owner._id,
    status: 'published',
    title: 'Tempest',
    pitch: 'Survive a storm-cursed island.',
    genres: ['survival'],
    platforms: ['web'],
    buildStage: 'alpha',
    engine: 'godot',
    coreGameplay: ['Explore', 'Hide from lightning'],
    playable: ['Two districts'],
    media: [{ type: 'image', key: 'games/tempest/cover.jpg' }],
    delivery: { method: 'web', webUrl: 'https://example.itch.io/tempest' },
    form,
    publishedAt: new Date(),
    ...overrides,
  });
}

export function createSubmittedReview(game, reviewer, overrides = {}) {
  return Review.create({
    game: game._id,
    reviewer: reviewer._id,
    gameVersion: game.version,
    deliveryMethod: game.delivery.method,
    form: {
      revision: 1,
      firstImpression: game.form.firstImpression,
      playtest: game.form.playtest,
      finalVerdict: game.form.finalVerdict,
    },
    status: 'submitted',
    submittedAt: new Date(),
    playtest: { playedSeconds: 2280 },
    finalVerdict: { changeText: 'Froze when lightning hit the tower.' },
    ...overrides,
  });
}

export function createReadyReview(game, reviewer) {
  const done = new Date();
  return createSubmittedReview(game, reviewer, {
    status: 'in_progress',
    submittedAt: null,
    firstImpression: {
      completedAt: done,
      answers: [
        { questionId: 'impression', text: 'Looks stormy.' },
        { questionId: 'difficulty', optionId: 'challenging' },
        { questionId: 'strength', optionId: 'visuals' },
        { questionId: 'audience', optionId: 'experienced' },
        { questionId: 'excitement', number: 4 },
      ],
    },
    playtest: { acceptedMissionIds: ['m1', 'm2'], playedSeconds: 600, completedAt: done },
    developerAnswers: { answers: [{ questionId: 'dq1', text: 'Yes' }], completedAt: done },
    finalVerdict: {
      comparison: 'better',
      changeText: 'Better than expected.',
      enjoyment: 5,
      improveCategory: 'ui',
      improveText: 'Bigger map icons.',
      completedAt: done,
    },
  });
}
