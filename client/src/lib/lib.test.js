import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api.js';
import { formatPlaytime, truncate } from './format.js';
import { toneForGenre } from './tagTones.js';

describe('formatPlaytime', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatPlaytime(0)).toBe('00:00');
    expect(formatPlaytime(21 * 60 + 30)).toBe('21:30');
    expect(formatPlaytime(75 * 60 + 4)).toBe('75:04');
  });
});

describe('truncate', () => {
  it('only shortens long text', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a long description', 6)).toBe('a long…');
  });
});

describe('toneForGenre', () => {
  it('maps genres to the tones used on the screens', () => {
    expect(toneForGenre('RPG')).toBe('blue');
    expect(toneForGenre('survival')).toBe('lime');
    expect(toneForGenre('unity')).toBe('neutral');
  });
});

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends JSON with the session cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: '1' }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/games', { title: 'Tempest' })).resolves.toEqual({ id: '1' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/games',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ title: 'Tempest' }),
      }),
    );
  });

  it('throws ApiError with the error body', async () => {
    const body = { code: 'UNAUTHORIZED', message: 'Log in to continue' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status: 401 })));

    const error = await api.get('/me').catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Log in to continue',
    });
  });
});
