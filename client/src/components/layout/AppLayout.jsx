import { useState } from 'react';
import { Outlet } from 'react-router';
import { useResource } from '../../features/shared/useResource.js';
import { cx } from '../../lib/cx.js';
import { MainNavigation } from './MainNavigation.jsx';
import { PageLookContext } from './pageLook.js';
import styles from './AppLayout.module.css';

// Page shell shared by the desktop screens: sky background, glass grid lines, navigation and
// a 1312 px content column. Pass `navigation` to swap the header, as the Sign up and Log in
// screens do; otherwise the main navigation shows the signed-in user. Pages can restyle the shell
// with usePageLook (pageLook.js), e.g. a game's background and colours.
export function AppLayout({ navigation }) {
  // Only the default header needs the session.
  const session = useResource(navigation ? null : '/me');
  const [look, setLook] = useState(null);
  return (
    <PageLookContext.Provider value={setLook}>
      <Shell look={look} navigation={navigation} user={session.data} />
    </PageLookContext.Provider>
  );
}

function Shell({ look, navigation, user }) {
  return (
    <div className={cx(styles.shell, look?.className)} style={look?.style}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.column}>
        {navigation ?? <MainNavigation user={user} />}
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
