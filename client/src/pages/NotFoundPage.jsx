import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { GlassPanel } from '../components/ui/GlassPanel.jsx';
import { TextLink } from '../components/ui/TextLink.jsx';
import styles from './PlaceholderPage.module.css';

export function NotFoundPage() {
  return (
    <GlassPanel variant="panel" className={styles.panel}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.text}>The page you are looking for does not exist.</p>
      <TextLink as={Link} to="/">
        Back to Explore Games
      </TextLink>
    </GlassPanel>
  );
}

// Route-level error boundary. Unknown URLs and thrown 404 responses show the not-found page.
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <GlassPanel variant="panel" className={styles.panel}>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.text}>Try again, or go back to Explore Games.</p>
      <TextLink as={Link} to="/">
        Back to Explore Games
      </TextLink>
    </GlassPanel>
  );
}
