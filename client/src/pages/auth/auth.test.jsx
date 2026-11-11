import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../mocks/server.js';
import { LogInPage } from './LogInPage.jsx';
import { SignUpPage } from './SignUpPage.jsx';

// These tests avoid real delays so a slow machine cannot change the outcome:
// - userEvent runs with `delay: null` and text is pasted instead of typed key by key;
// - the username check pause is 0 ms (`usernameCheckDelay`), except in the one test that is about
//   the pause, which controls it with fake timers;
// - nothing waits for the clock: every wait is for something that appears on screen.
const startUser = () => userEvent.setup({ delay: null });

function renderAt(path, { usernameCheckDelay = 0 } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Explore Games home</p>} />
        <Route path="/login" element={<LogInPage />} />
        <Route path="/signup" element={<SignUpPage usernameCheckDelay={usernameCheckDelay} />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function enter(user, label, text) {
  await user.click(screen.getByLabelText(label));
  await user.paste(text);
}

async function fillSignUp(user, { username, email, password, acceptTerms = true }) {
  if (username) await enter(user, 'Username', username);
  if (email) await enter(user, 'Email', email);
  if (password) await enter(user, 'Password', password);
  if (acceptTerms) {
    await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
  }
}

const submitSignUp = (user) => user.click(screen.getByRole('button', { name: 'Sign Up' }));
const validSignUp = {
  username: 'new_player',
  email: 'new@example.com',
  password: 'a-good-password',
};

function quiet() {
  return {
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  };
}

const usernameCheck = (handler) => http.get('*/api/auth/username-available', handler);
const usernameOf = (request) => new URL(request.url).searchParams.get('username');

describe('Sign up', () => {
  it('shows what is wrong with each field and sends nothing', async () => {
    const user = startUser();
    let requests = 0;
    server.use(
      http.post('*/api/auth/register', () => {
        requests += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderAt('/signup');

    await submitSignUp(user);

    expect(screen.getByText('Choose a username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Create a password.')).toBeInTheDocument();
    expect(screen.getByText('Accept the Terms and Conditions to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveFocus();
    expect(requests).toBe(0);
  });

  it('keeps the permanent-name guidance next to a username error', async () => {
    const user = startUser();
    renderAt('/signup');

    await submitSignUp(user);

    const username = screen.getByLabelText('Username');
    expect(screen.getByText('Choose a username.')).toBeInTheDocument();
    expect(screen.getByText(/This can’t be changed later\./)).toBeInTheDocument();
    expect(username).toBeInvalid();
    // Both the error and the guidance are announced with the field.
    expect(username.getAttribute('aria-describedby').split(' ')).toHaveLength(2);
  });

  it('rejects a short password before sending', async () => {
    const user = startUser();
    renderAt('/signup');

    await fillSignUp(user, { ...validSignUp, password: 'short' });
    await submitSignUp(user);

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
  });

  it('reports taken and reserved usernames as you type, and available ones', async () => {
    const user = startUser();
    renderAt('/signup');
    const field = screen.getByLabelText('Username');

    await user.click(field);
    await user.paste('enolaholmes');
    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument();
    expect(field).toBeInvalid();

    await user.clear(field);
    await user.paste('admin');
    expect(await screen.findByText('That username is reserved.')).toBeInTheDocument();

    await user.clear(field);
    await user.paste('fresh_name');
    expect(await screen.findByText('Username is available.')).toBeInTheDocument();
    expect(field).toBeValid();
  });

  it('announces the check result through a polite live region', async () => {
    const user = startUser();
    renderAt('/signup');
    const status = screen.getByRole('status');

    // The region exists before there is anything to say, so the first message is announced too.
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();

    await enter(user, 'Username', 'fresh_name');
    expect(await screen.findByText('Username is available.')).toBe(status);
  });

  it('ignores a late answer for a value that has since changed', async () => {
    const user = startUser();
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    let seenFirst;
    const firstSeen = new Promise((resolve) => (seenFirst = resolve));
    server.use(
      usernameCheck(async ({ request }) => {
        const username = usernameOf(request);
        if (username === 'abc') {
          seenFirst();
          await gate;
          return HttpResponse.json({ username, available: false, reason: 'taken' });
        }
        return HttpResponse.json({ username, available: true });
      }),
    );
    renderAt('/signup');

    await enter(user, 'Username', 'abc');
    await firstSeen;
    await user.keyboard('d');
    expect(await screen.findByText('Username is available.')).toBeInTheDocument();

    release();
    await act(async () => {
      await gate;
    });
    expect(screen.queryByText('That username is already taken.')).not.toBeInTheDocument();
    expect(screen.getByText('Username is available.')).toBeInTheDocument();
  });

  describe('when the username check fails', () => {
    it('says so, never claims the name is free, and can be retried', async () => {
      const { warn } = quiet();
      const user = startUser();
      let calls = 0;
      server.use(
        usernameCheck(({ request }) => {
          calls += 1;
          if (calls === 1) return HttpResponse.error();
          return HttpResponse.json({ username: usernameOf(request), available: true });
        }),
      );
      renderAt('/signup');

      await enter(user, 'Username', 'new_player');

      expect(await screen.findByText(/couldn’t check this username right now/)).toBeInTheDocument();
      expect(screen.queryByText(/Checking…/)).not.toBeInTheDocument();
      expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
      expect(warn).toHaveBeenCalledWith(
        '[auth] username availability check failed',
        expect.anything(),
      );

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Username is available.')).toBeInTheDocument();
      expect(calls).toBe(2);
    });

    it.each([
      [
        'a 429',
        () => HttpResponse.json({ code: 'RATE_LIMITED', message: 'Slow down' }, { status: 429 }),
      ],
      ['a 5xx', () => new HttpResponse('Bad Gateway', { status: 502 })],
      ['an answer that is not JSON', () => new HttpResponse('<html></html>', { status: 200 })],
      ['an answer without `available`', () => HttpResponse.json({ username: 'new_player' })],
    ])('treats %s as a failed check', async (_name, respond) => {
      quiet();
      const user = startUser();
      server.use(usernameCheck(respond));
      renderAt('/signup');

      await enter(user, 'Username', 'new_player');

      expect(await screen.findByText(/couldn’t check this username right now/)).toBeInTheDocument();
      expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
    });

    it('still lets the server decide on submit', async () => {
      quiet();
      const user = startUser();
      server.use(usernameCheck(() => HttpResponse.error()));
      renderAt('/signup');

      // `enolaholmes` is taken, but the check cannot tell: the form goes on and register answers 409.
      await fillSignUp(user, { ...validSignUp, username: 'enolaholmes' });
      await screen.findByText(/couldn’t check this username right now/);
      await submitSignUp(user);

      expect(await screen.findByText('Username is already taken')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInvalid();
      expect(screen.getByText(/This can’t be changed later\./)).toBeInTheDocument();
      expect(screen.queryByText(/couldn’t check/)).not.toBeInTheDocument();
    });
  });

  it('does not submit a username the API already said is taken', async () => {
    const user = startUser();
    let registers = 0;
    server.use(
      http.post('*/api/auth/register', () => {
        registers += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderAt('/signup');

    await fillSignUp(user, { ...validSignUp, username: 'enolaholmes' });
    await screen.findByText('That username is already taken.');
    await submitSignUp(user);

    expect(registers).toBe(0);
    expect(screen.getByLabelText('Username')).toHaveFocus();
  });

  it('creates the account and goes to Explore Games', async () => {
    const user = startUser();
    let body;
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'a'.repeat(24), username: body.username }, { status: 201 });
      }),
    );
    renderAt('/signup');

    await fillSignUp(user, { ...validSignUp, email: ' new@example.com ' });
    await submitSignUp(user);

    expect(await screen.findByText('Explore Games home')).toBeInTheDocument();
    expect(body).toEqual({
      username: 'new_player',
      email: 'new@example.com',
      password: 'a-good-password',
      acceptTerms: true,
    });
  });

  it('puts a 409 on the email field when the email is already registered', async () => {
    const user = startUser();
    renderAt('/signup');

    await fillSignUp(user, { ...validSignUp, email: 'enola@example.com' });
    await submitSignUp(user);

    expect(await screen.findByText('Email is already registered')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });

  it('maps a 400 from the API onto its field', async () => {
    const user = startUser();
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid',
            details: [{ path: '/body/email', message: 'must match format "email"' }],
          },
          { status: 400 },
        ),
      ),
    );
    renderAt('/signup');

    await fillSignUp(user, validSignUp);
    await submitSignUp(user);

    expect(await screen.findByText('Must match format "email"')).toBeInTheDocument();
  });

  it('shows the API message for a 429 above the button', async () => {
    const user = startUser();
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
          { status: 429 },
        ),
      ),
    );
    renderAt('/signup');

    await fillSignUp(user, validSignUp);
    await submitSignUp(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests, please try again later',
    );
  });

  describe('when the API fails in a way the spec does not describe', () => {
    it.each([
      ['a 502 gateway page', () => new HttpResponse('Bad Gateway', { status: 502 })],
      [
        'a 500 in the API format',
        () =>
          HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: 'stack trace for developers' },
            { status: 500 },
          ),
      ],
      ['a 404 that is not JSON', () => new HttpResponse('Not found', { status: 404 })],
      ['a 409 that is not JSON', () => new HttpResponse('Conflict', { status: 409 })],
      ['a 400 that is not JSON', () => new HttpResponse('Bad request', { status: 400 })],
    ])(
      'shows a plain sentence for %s and keeps the real error in the console',
      async (_name, respond) => {
        const { error } = quiet();
        const user = startUser();
        server.use(http.post('*/api/auth/register', respond));
        renderAt('/signup');

        await fillSignUp(user, validSignUp);
        await submitSignUp(user);

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Something went wrong. Please try again.',
        );
        expect(screen.queryByText(/Request failed with status/)).not.toBeInTheDocument();
        expect(error).toHaveBeenCalledWith(
          '[auth] request failed',
          expect.objectContaining({ name: 'ApiError', status: expect.any(Number) }),
        );
      },
    );

    it('does not treat a 200 that is not a user as a successful sign up', async () => {
      quiet();
      const user = startUser();
      server.use(
        http.post('*/api/auth/register', () => new HttpResponse('<html></html>', { status: 200 })),
      );
      renderAt('/signup');

      await fillSignUp(user, validSignUp);
      await submitSignUp(user);

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
      expect(screen.queryByText('Explore Games home')).not.toBeInTheDocument();
    });

    it('says so when the API cannot be reached', async () => {
      quiet();
      const user = startUser();
      server.use(http.post('*/api/auth/register', () => HttpResponse.error()));
      renderAt('/signup');

      await fillSignUp(user, validSignUp);
      await submitSignUp(user);

      expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t reach PlayLoop');
    });
  });

  it('links to Log in', () => {
    renderAt('/signup');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});

describe('Log in', () => {
  async function submitLogIn(user, email, password) {
    if (email) await enter(user, 'Email', email);
    if (password) await enter(user, 'Password', password);
    await user.click(screen.getByRole('button', { name: 'Log In' }));
  }

  it('asks for both fields without sending a request', async () => {
    const user = startUser();
    renderAt('/login');

    await submitLogIn(user);

    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('logs in and goes to Explore Games', async () => {
    const user = startUser();
    renderAt('/login');

    await submitLogIn(user, 'enola@example.com', 'storm-chaser-42');

    expect(await screen.findByText('Explore Games home')).toBeInTheDocument();
  });

  it('does not say whether the email or the password was wrong', async () => {
    const user = startUser();
    renderAt('/login');

    await submitLogIn(user, 'enola@example.com', 'not-the-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(screen.queryByText('Explore Games home')).not.toBeInTheDocument();
  });

  it('shows the reason for a suspended account', async () => {
    const user = startUser();
    renderAt('/login');

    await submitLogIn(user, 'suspended@example.com', 'suspended-pass1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account is suspended: Repeated spam reports',
    );
  });

  it('shows the API message for a 429', async () => {
    const user = startUser();
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
          { status: 429 },
        ),
      ),
    );
    renderAt('/login');

    await submitLogIn(user, 'enola@example.com', 'storm-chaser-42');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests, please try again later',
    );
  });

  it.each([
    ['a 502 gateway page', () => new HttpResponse('Bad Gateway', { status: 502 })],
    ['a 404 that is not JSON', () => new HttpResponse('Not found', { status: 404 })],
  ])(
    'shows a plain sentence for %s and keeps the real error in the console',
    async (_name, respond) => {
      const { error } = quiet();
      const user = startUser();
      server.use(http.post('*/api/auth/login', respond));
      renderAt('/login');

      await submitLogIn(user, 'enola@example.com', 'storm-chaser-42');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
      expect(error).toHaveBeenCalledWith('[auth] request failed', expect.anything());
    },
  );

  it('does not treat a 200 that is not a user as a successful login', async () => {
    quiet();
    const user = startUser();
    server.use(
      http.post('*/api/auth/login', () => new HttpResponse('<html></html>', { status: 200 })),
    );
    renderAt('/login');

    await submitLogIn(user, 'enola@example.com', 'storm-chaser-42');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByText('Explore Games home')).not.toBeInTheDocument();
  });

  it('says so when the API cannot be reached', async () => {
    quiet();
    const user = startUser();
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()));
    renderAt('/login');

    await submitLogIn(user, 'enola@example.com', 'storm-chaser-42');

    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t reach PlayLoop');
  });

  it('links to Sign up and Forgot password', () => {
    renderAt('/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
