import { ApiError } from '../../lib/api.js';

const NETWORK_MESSAGE = 'We couldn’t reach PlayLoop. Check your connection and try again.';
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export function isApiError(error, status) {
  return error instanceof ApiError && error.status === status;
}

// An answer from the API that follows its Error schema (docs/api: { code, message, details? }).
// Gateway pages, HTML and other bodies that are not JSON come out of apiFetch with the code
// UNKNOWN_ERROR and a message like "Request failed with status 502", which is not for users.
function isSchemaError(error) {
  return error instanceof ApiError && error.status < 500 && error.code !== 'UNKNOWN_ERROR';
}

// Message for a failure that belongs to the whole form. A documented 4xx error has a `message`
// written to be shown to the user (docs/api: Error.message) and is used as is. Anything else (5xx,
// a body that is not JSON, a network error, a bug) gets a plain sentence, and the real error goes
// to the console so it can still be debugged.
export function formMessage(error) {
  if (isSchemaError(error)) return error.message;

  console.error('[auth] request failed', error);
  return error instanceof ApiError ? GENERIC_MESSAGE : NETWORK_MESSAGE;
}

// A 400 or 409 in the API's own format, as opposed to one without a readable body.
export function isValidationError(error) {
  return isApiError(error, 400) && error.code === 'VALIDATION_ERROR';
}

export function isConflictError(error) {
  return isApiError(error, 409) && error.code === 'CONFLICT';
}

const USERNAME_UNAVAILABLE = {
  taken: 'That username is already taken.',
  invalid: 'That username isn’t valid.',
  reserved: 'That username is reserved.',
};

export function usernameUnavailableMessage(reason) {
  return USERNAME_UNAVAILABLE[reason] ?? 'That username isn’t available.';
}

// Moves keyboard focus to the first field that has a problem, in form order.
export function focusFirstInvalid(form, fieldOrder, errors) {
  const name = fieldOrder.find((field) => errors[field]);
  form?.elements.namedItem(name)?.focus();
}
