import { useCallback, useEffect, useState } from 'react';
import { checkUsername } from '../../lib/auth.js';
import { validateUsername } from '../../lib/authValidation.js';

export const USERNAME_CHECK_DELAY_MS = 400;

// Live "is this username free?" check for the Sign up form (GET /auth/username-available).
//
// Returns { status, reason, retry }. `status` is one of
//   idle         nothing to check yet (empty, or not a well-formed username)
//   checking     waiting for the answer to the current value
//   available    the API said it is free
//   unavailable  the API said it is not; `reason` is taken | invalid | reserved
//   error        the check itself failed (network, 429, 5xx or an unreadable answer)
// `retry()` asks again after an `error`.
//
// "available" is only ever reported from a successful answer for the exact value in the field. A
// failed check is never shown as available: the form then lets the server decide on submit, since
// POST /auth/register validates the username again (409 CONFLICT when it is taken).
export function useUsernameAvailability(username, { delay = USERNAME_CHECK_DELAY_MS } = {}) {
  // The result remembers which value and attempt it answers, so a late answer for an older value
  // is never shown for the current one.
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const checkable = validateUsername(username) === null;

  useEffect(() => {
    if (!checkable) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const answer = await checkUsername(username, { signal: controller.signal });
        // This check was replaced while it was in flight. Drop its answer even if the request
        // was not actually cancelled, so it cannot overwrite the result for the current value.
        if (controller.signal.aborted) return;
        if (typeof answer?.available !== 'boolean')
          throw new Error('Unreadable availability answer');
        setResult({ username, attempt, available: answer.available, reason: answer.reason });
      } catch (error) {
        // Aborted by a newer keystroke or by leaving the page: not a failure.
        if (controller.signal.aborted) return;
        console.warn('[auth] username availability check failed', error);
        setResult({ username, attempt, failed: true });
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, checkable, attempt, delay]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  if (!checkable) return { status: 'idle', retry };
  if (result?.username !== username || result.attempt !== attempt) {
    return { status: 'checking', retry };
  }
  if (result.failed) return { status: 'error', retry };
  if (result.available) return { status: 'available', retry };
  return { status: 'unavailable', reason: result.reason, retry };
}
