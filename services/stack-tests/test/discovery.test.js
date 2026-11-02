import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

let dev;

beforeEach(async () => {
  dev = await createUser();
});

async function reviews(game, count, days) {
  for (let i = 0; i < count; i += 1) {
    await createSubmittedReview(game, await createUser(), { submittedAt: daysAgo(days) });
  }
}

describe('popular sort', () => {
  it('ranks by reviews submitted in the last 30 days', async () => {
    const trending = await createPublishedGame(dev, { title: 'Trending' });
    const oldHit = await createPublishedGame(dev, { title: 'Old hit', reviewCount: 50 });
    const quiet = await createPublishedGame(dev, { title: 'Quiet' });
    await reviews(trending, 2, 3);
    await reviews(oldHit, 4, 45);
    await reviews(quiet, 1, 10);

    const res = await request(app).get('/api/games?sort=popular');
    expect(res.status).toBe(200);
    expect(res.body.items.map((g) => g.title)).toEqual(['Trending', 'Quiet', 'Old hit']);

    const page2 = await request(app).get('/api/games?sort=popular&limit=2&page=2');
    expect(page2.body).toMatchObject({ total: 3, page: 2 });
    expect(page2.body.items.map((g) => g.title)).toEqual(['Old hit']);
  });
});

describe('recommendations', () => {
  it('shows popular games when logged out', async () => {
    await reviews(await createPublishedGame(dev, { title: 'Busy' }), 2, 1);
    await createPublishedGame(dev, { title: 'New' });
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.items.map((g) => g.title)).toEqual(['Busy', 'New']);
  });

  it('prefers favourite genres and skips own and already reviewed games', async () => {
    const me = await createUser({ favoriteGenres: ['horror'] });
    await createPublishedGame(dev, { title: 'Horror pick', genres: ['horror'] });
    await createPublishedGame(dev, { title: 'Filler', genres: ['racing'] });
    await createPublishedGame(me, { title: 'My own', genres: ['horror'] });
    const reviewed = await createPublishedGame(dev, { title: 'Reviewed', genres: ['horror'] });
    await createSubmittedReview(reviewed, me);

    const res = await request(app)
      .get('/api/recommendations?limit=5')
      .set({ Cookie: authCookie(me) });
    expect(res.body.items.map((g) => g.title)).toEqual(['Horror pick', 'Filler']);
  });
});
