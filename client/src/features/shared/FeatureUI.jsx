import { Link } from 'react-router';
import { Avatar, Button, GlassPanel, Tag } from '../../components/index.js';
import styles from './Features.module.css';

import { nameOf, label } from './format.js';

export function PageHeader({ title, children, action }) {
  return (
    <header className={styles.header}>
      <div className={styles.stack}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
      {action}
    </header>
  );
}
export function RequestState({ resource, children }) {
  if (resource.loading) return <GlassPanel role="status">Loading…</GlassPanel>;
  if (resource.error)
    return (
      <GlassPanel role="alert" className={styles.stack}>
        <p>
          {resource.error.status === 401
            ? 'Log in to access your PlayLoop workspace.'
            : resource.error.message}
        </p>
        <div className={styles.row}>
          {resource.error.status === 401 && (
            <Button as={Link} to="/login">
              Log in
            </Button>
          )}
          <Button variant="glass" onClick={resource.refresh}>
            Try again
          </Button>
        </div>
      </GlassPanel>
    );
  return children;
}
export function Pagination({ data, page, setPage }) {
  if (!data || data.total <= data.limit) return null;
  return (
    <nav aria-label="Pagination" className={styles.pagination}>
      <Button variant="glass" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page} of {Math.ceil(data.total / data.limit)}
      </span>
      <Button
        variant="glass"
        disabled={page * data.limit >= data.total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
export function Reviewer({ user, subtitle, size = 64 }) {
  return (
    <div className={styles.row}>
      <Avatar src={user?.avatarUrl} name={nameOf(user)} size={size} />
      <div>
        <h3>{nameOf(user)}</h3>
        <p className={styles.caption}>{subtitle}</p>
      </div>
    </div>
  );
}
export function FeedbackBadge({ status }) {
  return (
    <Tag tone={{ new: 'sunny', reviewed: 'sky', planned: 'blue', fixed: 'lime' }[status]}>
      {label(status)}
    </Tag>
  );
}
export function EmptyState({ children }) {
  return <GlassPanel className={styles.empty}>{children}</GlassPanel>;
}
