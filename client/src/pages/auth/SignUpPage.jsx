import { useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Checkbox, PrimaryButton, TextField, TextLink } from '../../components/index.js';
import { register } from '../../lib/auth.js';
import { capitalize, fieldErrorsFromDetails, validateSignUp } from '../../lib/authValidation.js';
import { cx } from '../../lib/cx.js';
import { AuthCard, FormError, SwitchFlow } from './AuthCard.jsx';
import { AuthPage } from './AuthPage.jsx';
import {
  focusFirstInvalid,
  formMessage,
  isConflictError,
  isValidationError,
  usernameUnavailableMessage,
} from './authErrors.js';
import { USERNAME_CHECK_DELAY_MS, useUsernameAvailability } from './useUsernameAvailability.js';
import styles from './SignUpPage.module.css';

const FIELDS = ['username', 'email', 'password', 'acceptTerms'];

// Sign up. Figma: sign up (232:699). API: POST /auth/register, GET /auth/username-available.
// `usernameCheckDelay` is the pause after typing before the availability check is sent.
export function SignUpPage({ usernameCheckDelay = USERNAME_CHECK_DELAY_MS }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const termsId = useId();
  const [values, setValues] = useState({
    username: '',
    email: '',
    password: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const availability = useUsernameAvailability(values.username, { delay: usernameCheckDelay });

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear a field's message as soon as the person edits it.
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setFormError('');
  }

  function showErrors(next, message = '') {
    setErrors(next);
    setFormError(message);
    focusFirstInvalid(formRef.current, FIELDS, next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const found = validateSignUp(values);
    // A name the API already said is not available stops the submit. Every other state, including
    // a check that failed or is still running, goes on to the server, which checks it again.
    const unavailable = !found.username && availability.status === 'unavailable';
    if (unavailable || Object.keys(found).length > 0) {
      setErrors(found);
      setFormError('');
      focusFirstInvalid(
        formRef.current,
        FIELDS,
        unavailable ? { ...found, username: true } : found,
      );
      return;
    }

    setSubmitting(true);
    try {
      await register({
        username: values.username,
        email: values.email.trim(),
        password: values.password,
      });
      navigate('/', { replace: true });
    } catch (error) {
      if (isValidationError(error)) {
        const { byField, rest } = fieldErrorsFromDetails(error.details, FIELDS);
        showErrors(byField, rest.join(' ') || (Object.keys(byField).length ? '' : error.message));
      } else if (isConflictError(error)) {
        // The spec's 409 does not say which value clashed, so the message decides where it shows.
        const field = /username/i.test(error.message)
          ? 'username'
          : /email/i.test(error.message)
            ? 'email'
            : null;
        if (field) showErrors({ [field]: capitalize(error.message) });
        else showErrors({}, error.message);
      } else {
        showErrors({}, formMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const unavailable = availability.status === 'unavailable';

  return (
    <AuthPage title="Sign Up" message="Join PlayLoop to publish your games and review others.">
      <AuthCard ref={formRef} aria-label="Sign up" onSubmit={handleSubmit}>
        <div className={styles.usernameGroup}>
          <TextField
            radius="sm"
            name="username"
            label="Username"
            placeholder="Choose a username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            onChange={(event) => update('username', event.target.value)}
            error={errors.username}
            keepHint
            hint={
              <>
                Letters, numbers and _ only.
                <br />
                This can’t be changed later.
              </>
            }
            {...(unavailable && { 'aria-invalid': true })}
          />
          <UsernameStatus availability={availability} hidden={Boolean(errors.username)} />
        </div>
        <TextField
          radius="sm"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          error={errors.email}
        />
        <TextField
          radius="sm"
          name="password"
          type="password"
          label="Password"
          placeholder="Create a password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => update('password', event.target.value)}
          error={errors.password}
          hint="At least 8 characters."
        />

        <div>
          <div className={styles.terms}>
            <Checkbox
              id={termsId}
              name="acceptTerms"
              checked={values.acceptTerms}
              onChange={(event) => update('acceptTerms', event.target.checked)}
              aria-label="I agree to the Terms and Conditions"
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? `${termsId}-error` : undefined}
            />
            <p className={styles.termsText}>
              <label htmlFor={termsId}>I agree to the </label>
              <TextLink as={Link} to="/terms" size="sm" underline>
                Terms and Conditions
              </TextLink>
            </p>
          </div>
          {errors.acceptTerms && (
            <p id={`${termsId}-error`} role="alert" className={styles.termsError}>
              {errors.acceptTerms}
            </p>
          )}
        </div>

        <FormError>{formError}</FormError>
        <PrimaryButton type="submit" size="md" fullWidth disabled={submitting}>
          Sign Up
        </PrimaryButton>
        <SwitchFlow prompt="Already have an account?" to="/login">
          Log in
        </SwitchFlow>
      </AuthCard>
    </AuthPage>
  );
}

// Result of the live username check. It is always in the page (empty when there is nothing to say)
// and is a polite live region, so a screen reader announces each change. A failed check says so
// and offers "Try again"; it never claims the name is available.
function UsernameStatus({ availability, hidden }) {
  const { status, reason, retry } = availability;
  let content = null;
  if (!hidden) {
    if (status === 'checking') content = 'Checking…';
    else if (status === 'available') content = 'Username is available.';
    else if (status === 'unavailable') content = usernameUnavailableMessage(reason);
    else if (status === 'error') {
      content = (
        <>
          We couldn’t check this username right now. We’ll check again when you sign up.{' '}
          <TextLink as="button" type="button" size="sm" underline onClick={retry}>
            Try again
          </TextLink>
        </>
      );
    }
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className={cx(styles.status, !hidden && status === 'unavailable' && styles.statusError)}
    >
      {content}
    </p>
  );
}
