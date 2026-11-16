import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { NotificationBell } from '../../features/notifications/NotificationBell.jsx';
import { BrandMark } from '../ui/BrandMark.jsx';
import { Button } from '../ui/Button.jsx';
import { logout } from '../../lib/auth.js';
import { cx } from '../../lib/cx.js';
import styles from './MainNavigation.module.css';

// Desktop navigation. Figma: Handoff / Main navigation (426:1616). Mobile navigation is not
// designed yet; below the desktop width the items simply wrap.
export function MainNavigation({
  user,
  exploreLabel = 'Explore Games',
  myGamesLabel = 'My Games',
  profileLabel = 'Avatar',
  className,
}) {
  return (
    <nav aria-label="Main" className={cx(styles.nav, className)}>
      <BrandMark />
      <NavLink to="/" end className={styles.link}>
        {exploreLabel}
      </NavLink>
      <NavLink to="/my-games" className={styles.link}>
        {myGamesLabel}
      </NavLink>
      <NavLink to={user ? `/users/${user.username}` : '/login'} className={styles.link}>
        {profileLabel}
      </NavLink>
      <NotificationBell user={user} />
      {user ? (
        <LogOutButton />
      ) : (
        <Button as={Link} to="/login">
          Log In
        </Button>
      )}
    </nav>
  );
}

// Log Out is not in Figma; it takes the place of Log In once someone is signed in. POST
// /auth/logout clears the session cookie, then the app reloads on Explore Games so every page
// drops what it loaded for the signed-in user. A 401 means the session had already ended.
function LogOutButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setBusy(true);
    setFailed(false);
    try {
      await logout();
    } catch (error) {
      if (error.status !== 401) {
        setFailed(true);
        setBusy(false);
        return;
      }
    }
    window.location.assign('/');
  }

  return (
    <>
      <Button variant="glass" disabled={busy} onClick={handleClick}>
        {busy ? 'Logging out…' : 'Log Out'}
      </Button>
      {failed && (
        <p role="alert" className={styles.link}>
          Couldn’t log out. Try again.
        </p>
      )}
    </>
  );
}
