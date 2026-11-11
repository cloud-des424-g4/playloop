import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PrimaryButton, TextField, TextLink } from '../../components/index.js';
import { login } from '../../lib/auth.js';
import { fieldErrorsFromDetails, validateLogIn } from '../../lib/authValidation.js';
import { AuthCard, FormError, SwitchFlow } from './AuthCard.jsx';
import { AuthPage } from './AuthPage.jsx';
import { focusFirstInvalid, formMessage, isValidationError } from './authErrors.js';
import styles from './LogInPage.module.css';

const FIELDS = ['email', 'password'];

// Log in. Figma: log in (232:744). API: POST /auth/login.
//
// The Figma field is labelled "Email or username", but LoginInput only accepts `email`
// (docs/api/schemas/auth.yaml), so the field says Email until the API takes usernames too.
export function LogInPage() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
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

    const found = validateLogIn(values);
    if (Object.keys(found).length > 0) return showErrors(found);

    setSubmitting(true);
    try {
      await login({ email: values.email.trim(), password: values.password });
      navigate('/', { replace: true });
    } catch (error) {
      if (isValidationError(error)) {
        const { byField, rest } = fieldErrorsFromDetails(error.details, FIELDS);
        showErrors(byField, rest.join(' ') || (Object.keys(byField).length ? '' : error.message));
      } else {
        // 401 (wrong email or password), 403 (suspended or banned, with the reason) and 429 show
        // the API's message above the button; 5xx and network failures get a plain sentence.
        showErrors({}, formMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPage title="Log In" message="Welcome back. Play games. Get played.">
      <AuthCard ref={formRef} spacing="regular" aria-label="Log in" onSubmit={handleSubmit}>
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

        <div className={styles.passwordGroup}>
          <TextField
            radius="sm"
            name="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
            error={errors.password}
          />
          <TextLink as={Link} to="/forgot-password" size="sm" underline className={styles.forgot}>
            Forgot password?
          </TextLink>
        </div>

        <FormError>{formError}</FormError>
        <PrimaryButton type="submit" size="md" fullWidth disabled={submitting}>
          Log In
        </PrimaryButton>
        <SwitchFlow prompt="New to PlayLoop?" to="/signup">
          Sign up
        </SwitchFlow>
      </AuthCard>
    </AuthPage>
  );
}
