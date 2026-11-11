import { Link, NavLink } from 'react-router';
import { NotificationBell } from '../../features/notifications/NotificationBell.jsx';
import { BrandMark } from '../ui/BrandMark.jsx';
import { Button } from '../ui/Button.jsx';
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
      {!user && (
        <Button as={Link} to="/login">
          Log In
        </Button>
      )}
    </nav>
  );
}
