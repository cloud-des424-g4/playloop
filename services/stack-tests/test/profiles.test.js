import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { Game } from '../../community/src/modules/games/game.model.js';
import { authCookie, createPublishedGame, createSubmittedReview, createUser } from './helpers.js';

const app = createApp();

describe('profiles', () => {
  it('edits the logged-in profile and keeps the username fixed', async () => {
    const user = await createUser({ email: 'enola@example.com', username: 'enolaholmes' });

    const updated = await request(app)
      .patch('/api/me')
      .set('Cookie', authCookie(user))
      .send({
        displayName: 'Enola',
        pronouns: 'she/her',
        bio: 'Indie dev making stormy games.',
        favoriteGenres: ['survival', 'horror'],
        platforms: ['pc', 'web'],
        links: [{ label: 'Website', url: 'https://enola.games' }],
      });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      username: 'enolaholmes',
      displayName: 'Enola',
      pronouns: 'she/her',
      bio: 'Indie dev making stormy games.',
      favoriteGenres: ['survival', 'horror'],
      platforms: ['pc', 'web'],
      links: [{ label: 'Website', url: 'https://enola.games' }],
    });

    const username = await request(app)
      .patch('/api/me')
      .set('Cookie', authCookie(user))
      .send({ username: 'othername' });
    expect(username.status).toBe(400);

    const genre = await request(app)
      .patch('/api/me')
      .set('Cookie', authCookie(user))
      .send({ favoriteGenres: ['not_a_genre'] });
    expect(genre.status).toBe(400);

    const avatar = await request(app)
      .patch('/api/me')
      .set('Cookie', authCookie(user))
      .send({ avatarUploadId: user._id.toString() });
    expect(avatar.status).toBe(400);
  });

  it('shows a public profile, published games, and submitted reviews', async () => {
    const user = await createUser({
      username: 'enolaholmes',
      displayName: 'Enola',
      bio: 'Indie dev making stormy games.',
      reputationPoints: 1240,
    });
    const viewer = await createUser();
    const game = await createPublishedGame(user);
    await Game.create({ owner: user._id, title: 'Draft only' });
    const review = await createSubmittedReview(game, user, { helpfulCount: 4 });
    await createSubmittedReview(game, viewer, { gameVersion: 'other' });

    const profile = await request(app)
      .get('/api/users/EnolaHolmes')
      .set('Cookie', authCookie(user));
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({
      username: 'enolaholmes',
      displayName: 'Enola',
      isMe: true,
      reputation: { points: 1240, level: 4, title: 'Critic', nextLevelMinPoints: 1500 },
      stats: { reviewsWritten: 1, gamesPublished: 1, helpfulVotes: 4 },
    });
    expect(profile.body.email).toBeUndefined();

    const stranger = await request(app).get('/api/users/enolaholmes');
    expect(stranger.body.isMe).toBe(false);

    const games = await request(app).get('/api/users/enolaholmes/games');
    expect(games.status).toBe(200);
    expect(games.body.total).toBe(1);
    expect(games.body.items[0]).toMatchObject({ id: game._id.toString(), title: 'Tempest' });

    const reviews = await request(app).get('/api/users/enolaholmes/reviews');
    expect(reviews.body.total).toBe(1);
    expect(reviews.body.items[0]).toMatchObject({
      id: review._id.toString(),
      excerpt: 'Froze when lightning hit the tower.',
      helpfulCount: 4,
    });

    const missing = await request(app).get('/api/users/nobody');
    expect(missing.status).toBe(404);
  });
});
