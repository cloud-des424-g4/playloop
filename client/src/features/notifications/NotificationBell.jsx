import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { api } from '../../lib/api.js';
import { Pagination, RequestState } from '../shared/FeatureUI.jsx';
import { date } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import bell from '../../assets/features/bell.svg';
import styles from './NotificationBell.module.css';

// Notifications can only navigate to an in-app route, even if an API record is malformed.
function internalLink(notification) {
  if (notification.reviewId) return `/reviews/${encodeURIComponent(notification.reviewId)}`;
  const link = notification.link;
  return typeof link === 'string' &&
    /^\/(?!\/)/.test(link) &&
    !link.includes('\\') &&
    ![...link].some((c) => c.charCodeAt(0) <= 32)
    ? link
    : '/my-games';
}
export function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef(null);
  const trigger = useRef(null);
  const panel = useRef(null);
  const navigate = useNavigate();
  const count = useResource(user ? '/me/notifications/unread-count' : null);
  const list = useResource(open && user ? `/me/notifications?page=${page}&limit=10` : null);
  const refreshCount = count.refresh;
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(refreshCount, 60000);
    window.addEventListener('focus', refreshCount);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshCount);
    };
  }, [user, refreshCount]);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    function outside(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  async function markAll() {
    setBusy(true);
    setError('');
    try {
      await api.post('/me/notifications/read-all');
      count.refresh();
      list.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function follow(notification) {
    setBusy(true);
    setError('');
    try {
      if (!notification.read) await api.post(`/me/notifications/${notification.id}/read`);
      count.refresh();
      setOpen(false);
      navigate(internalLink(notification));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const unread = count.data?.count || 0;
  return (
    <div
      ref={root}
      className={styles.root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className={styles.trigger}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen(!open);
          setError('');
          count.refresh();
          list.refresh();
        }}
      >
        <img src={bell} alt="" />
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <section
          ref={panel}
          tabIndex={-1}
          id="notification-panel"
          className={styles.panel}
          aria-label="Notifications"
        >
          <div className={styles.heading}>
            <h2>Notifications</h2>
            <button
              className={styles.close}
              aria-label="Close notifications"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          {!user ? (
            <p>
              <Link to="/login" onClick={() => setOpen(false)}>
                Log in
              </Link>{' '}
              to see your notifications.
            </p>
          ) : (
            <>
              <Button variant="glass" disabled={busy || !list.data?.unreadCount} onClick={markAll}>
                Mark all as read
              </Button>
              <RequestState resource={list}>
                {list.data?.items.length === 0 && <p>You’re all caught up.</p>}
                <ul className={styles.list}>
                  {list.data?.items.map((notification) => (
                    <li key={notification.id}>
                      <button
                        disabled={busy}
                        className={styles.item}
                        data-unread={!notification.read}
                        onClick={() => follow(notification)}
                      >
                        <span>{notification.message}</span>
                        <small>
                          {date(notification.createdAt)}
                          {!notification.read && ' · Unread'}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
                <Pagination data={list.data} page={page} setPage={setPage} />
              </RequestState>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
}
