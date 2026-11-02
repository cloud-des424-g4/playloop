import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();

let dev;
let game;

beforeEach(async () => {
  dev = await createUser();
  game = await createPublishedGame(dev);
});

const list = (query = '') => request(app).get(`/api/games/${game._id}/reviews${query}`);

describe('GET /games/{gameId}/reviews', () => {
  it('lists only submitted reviews, most helpful first by default', async () => {
    const low = await createSubmittedReview(game, await createUser(), { helpfulCount: 1 });
    const high = await createSubmittedReview(game, await createUser(), {
      helpfulCount: 9,
      playtest: {
        playedSeconds: 600,
        cards: [
          { type: 'bug', missionId: 'm1', comment: 'Froze', playedSeconds: 60 },
          { type: 'enjoyed', missionId: 'm1', comment: 'Nice', playedSeconds: 90 },
          { type: 'bug', missionId: 'm2', comment: 'Fell through', playedSeconds: 300 },
        ],
      },
    });
    await createSubmittedReview(game, await createUser(), { status: 'in_progress' });

    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((r) => r.id)).toEqual([high.id, low.id]);
    expect(res.body.items[0].cardCounts).toEqual({ confused: 0, enjoyed: 1, bug: 2 });
    expect(res.body.items[0].finalVerdict.changeText).toBe('Froze when lightning hit the tower.');
  });

  it('sorts by newest and filters by version', async () => {
    const old = await createSubmittedReview(game, await createUser(), {
      gameVersion: '0.1',
      submittedAt: new Date('2026-09-01'),
    });
    const recent = await createSubmittedReview(game, await createUser(), { gameVersion: '0.2' });

    const newest = await list('?sort=newest');
    expect(newest.body.items.map((r) => r.id)).toEqual([recent.id, old.id]);

    const v1 = await list('?version=0.1');
    expect(v1.body.items.map((r) => r.id)).toEqual([old.id]);
  });

  it('hides the reviews of a draft game, the owner uses the Feedback Inbox instead', async () => {
    const draft = await createPublishedGame(dev, { status: 'draft' });
    expect((await request(app).get(`/api/games/${draft._id}/reviews`)).status).toBe(404);
    const owner = await request(app)
      .get(`/api/games/${draft._id}/reviews`)
      .set({ Cookie: authCookie(dev) });
    expect(owner.status).toBe(404);
  });
});
