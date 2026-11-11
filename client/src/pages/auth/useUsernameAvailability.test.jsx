import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkUsername } from '../../lib/auth.js';
import { useUsernameAvailability } from './useUsernameAvailability.js';

// The hook with the API mocked and the clock under the test's control (see setup.js, which puts
// real timers back after each test). Nothing here waits for real time, so a slow machine cannot
// change the result.
vi.mock('../../lib/auth.js', () => ({ checkUsername: vi.fn() }));

const DELAY = 400;

// Moves the fake clock and lets the promises it unblocks settle.
const advance = (ms) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });

function setup(initialName = '') {
  return renderHook(({ name }) => useUsernameAvailability(name, { delay: DELAY }), {
    initialProps: { name: initialName },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  checkUsername.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('useUsernameAvailability', () => {
  it('stays idle and asks nothing for an empty or malformed username', async () => {
    const { result, rerender } = setup('');
    expect(result.current.status).toBe('idle');

    rerender({ name: 'no spaces' });
    rerender({ name: 'ab' });
    await advance(DELAY * 3);

    expect(result.current.status).toBe('idle');
    expect(checkUsername).not.toHaveBeenCalled();
  });

  it('waits for a pause in typing and asks once, for the final value', async () => {
    checkUsername.mockResolvedValue({ username: 'abcd', available: true });
    const { result, rerender } = setup('abc');
    rerender({ name: 'abcd' });

    expect(result.current.status).toBe('checking');
    await advance(DELAY - 1);
    expect(checkUsername).not.toHaveBeenCalled();

    await advance(1);
    expect(checkUsername).toHaveBeenCalledTimes(1);
    expect(checkUsername.mock.calls[0][0]).toBe('abcd');
    expect(result.current.status).toBe('available');
  });

  it('restarts the pause on every change', async () => {
    checkUsername.mockResolvedValue({ username: 'abcd', available: true });
    const { rerender } = setup('abc');

    await advance(DELAY - 100);
    rerender({ name: 'abcd' });
    await advance(DELAY - 100);
    expect(checkUsername).not.toHaveBeenCalled();

    await advance(100);
    expect(checkUsername).toHaveBeenCalledTimes(1);
  });

  it('reports why a name is not available', async () => {
    checkUsername.mockResolvedValue({ username: 'admin', available: false, reason: 'reserved' });
    const { result } = setup('admin');

    await advance(DELAY);

    expect(result.current).toMatchObject({ status: 'unavailable', reason: 'reserved' });
  });

  it('never shows an answer for a value that has since changed', async () => {
    let answerFirst;
    checkUsername.mockImplementationOnce(
      () =>
        new Promise(
          (resolve) => (answerFirst = () => resolve({ available: false, reason: 'taken' })),
        ),
    );
    checkUsername.mockResolvedValueOnce({ username: 'abcd', available: true });
    const { result, rerender } = setup('abc');

    await advance(DELAY);
    expect(result.current.status).toBe('checking');

    rerender({ name: 'abcd' });
    await advance(DELAY);
    expect(result.current.status).toBe('available');

    await act(async () => answerFirst());
    expect(result.current.status).toBe('available');
  });

  describe('when the check fails', () => {
    it('reports an error, not "available" and not "checking", and logs the cause', async () => {
      const failure = new Error('offline');
      checkUsername.mockRejectedValue(failure);
      const { result } = setup('new_player');

      await advance(DELAY);

      expect(result.current.status).toBe('error');
      expect(console.warn).toHaveBeenCalledWith(
        '[auth] username availability check failed',
        failure,
      );
    });

    it.each([
      ['a body without `available`', { username: 'new_player' }],
      ['an empty body', null],
      ['`available` that is not a boolean', { available: 'yes' }],
    ])('treats %s as a failed check', async (_name, answer) => {
      checkUsername.mockResolvedValue(answer);
      const { result } = setup('new_player');

      await advance(DELAY);

      expect(result.current.status).toBe('error');
    });

    it('asks again on retry() and recovers', async () => {
      checkUsername.mockRejectedValueOnce(new Error('offline'));
      checkUsername.mockResolvedValueOnce({ username: 'new_player', available: true });
      const { result } = setup('new_player');

      await advance(DELAY);
      expect(result.current.status).toBe('error');

      act(() => result.current.retry());
      expect(result.current.status).toBe('checking');
      await advance(DELAY);

      expect(checkUsername).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe('available');
    });

    it('goes back to checking when the value changes', async () => {
      checkUsername.mockRejectedValueOnce(new Error('offline'));
      checkUsername.mockResolvedValueOnce({ username: 'other_name', available: true });
      const { result, rerender } = setup('new_player');

      await advance(DELAY);
      expect(result.current.status).toBe('error');

      rerender({ name: 'other_name' });
      expect(result.current.status).toBe('checking');
      await advance(DELAY);

      expect(result.current.status).toBe('available');
    });
  });
});
