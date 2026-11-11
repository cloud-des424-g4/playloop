import { Link, NavLink, Outlet } from 'react-router';
import { BrandMark, Button, InitialAvatar, TextLink } from '../../components/index.js';
import { nameOf } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import styles from './Admin.module.css';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/reports', label: 'Report queue' },
  { to: '/admin/moderation', label: 'Content Moderation' },
  { to: '/admin/users', label: 'User Management' },
  { to: '/admin/featured', label: 'Feature Games' },
  { to: '/admin/settings', label: 'Configuration' },
];

// Admin shell (Figma 375:1089): sidebar navigation, the signed-in admin top right and a 947 px
// content column. The API enforces the admin role; this only decides what to show.
export function AdminLayout() {
  const session = useResource('/me');
  const me = session.data;
  const isAdmin = me?.role === 'admin';
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarInner}>
          <BrandMark />
          {isAdmin && (
            <nav aria-label="Admin" className={styles.nav}>
              {links.map(({ label, ...link }) => (
                <NavLink key={link.to} {...link} className={styles.navLink}>
                  {label}
                </NavLink>
              ))}
            </nav>
          )}
          <TextLink as={Link} to="/" className={styles.back}>
            ‹ Back to PlayLoop
          </TextLink>
        </div>
      </aside>
      <div className={styles.body}>
        <header className={styles.topBar}>
          {isAdmin && (
            <>
              <span className={styles.pillButton}>Admin</span>
              <InitialAvatar name={nameOf(me)} />
            </>
          )}
        </header>
        <main id="main" className={styles.main}>
          {isAdmin ? <Outlet context={{ me }} /> : <Gate session={session} />}
        </main>
      </div>
    </div>
  );
}

function Gate({ session }) {
  if (session.loading)
    return (
      <p role="status" className={styles.card}>
        Loading…
      </p>
    );
  const loggedOut = session.error?.status === 401;
  return (
    <div role="alert" className={styles.card}>
      <h1 className={styles.heading2}>
        {loggedOut ? 'Log in to open the admin area' : 'This area is for admins'}
      </h1>
      <p className={styles.muted}>
        {loggedOut
          ? 'You need an admin account to moderate PlayLoop.'
          : session.error
            ? session.error.message
            : 'Your account doesn’t have the admin role.'}
      </p>
      <div className={styles.row}>
        {loggedOut ? (
          <Button as={Link} to="/login">
            Log in
          </Button>
        ) : (
          <Button as={Link} to="/">
            Back to PlayLoop
          </Button>
        )}
        {session.error && !loggedOut && (
          <Button variant="glass" onClick={session.refresh}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
