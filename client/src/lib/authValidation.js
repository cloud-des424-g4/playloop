// Client-side checks that mirror docs/api/schemas/common.yaml and auth.yaml, so the form can point
// at a field before a request is sent. The server stays the source of truth: it re-validates and
// answers 400 VALIDATION_ERROR with `details[].path` like `/body/username`.

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export function validateUsername(value) {
  if (!value) return 'Choose a username.';
  if (!USERNAME_PATTERN.test(value)) return 'Use 3–20 letters, numbers or _.';
  return null;
}

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return 'Enter your email.';
  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  return null;
}

export function validateNewPassword(value) {
  if (!value) return 'Create a password.';
  if (value.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (value.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  return null;
}

// Log in only needs a non-empty password: an existing one may predate the current rules.
export function validateExistingPassword(value) {
  if (!value) return 'Enter your password.';
  if (value.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  return null;
}

// Drops fields without a problem, so the result is {} when the form is valid.
function onlyErrors(checks) {
  return Object.fromEntries(Object.entries(checks).filter(([, message]) => message));
}

export function validateSignUp({ username, email, password, acceptTerms }) {
  return onlyErrors({
    username: validateUsername(username),
    email: validateEmail(email),
    password: validateNewPassword(password),
    acceptTerms: acceptTerms ? null : 'Accept the Terms and Conditions to continue.',
  });
}

export function validateLogIn({ email, password }) {
  return onlyErrors({
    email: validateEmail(email),
    password: validateExistingPassword(password),
  });
}

// Maps an ApiError's `details` (paths like `/body/email`) onto form fields. Problems that point at
// no known field come back in `rest` so the form can show them as one message.
export function fieldErrorsFromDetails(details, fields) {
  const byField = {};
  const rest = [];
  for (const { path, message } of details ?? []) {
    const field = path.split('/').pop();
    if (fields.includes(field) && !byField[field]) byField[field] = capitalize(message);
    else if (!fields.includes(field)) rest.push(capitalize(message));
  }
  return { byField, rest };
}

export function capitalize(message) {
  return message.charAt(0).toUpperCase() + message.slice(1);
}
