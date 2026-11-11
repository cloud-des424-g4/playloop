import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import {
  Button,
  InitialAvatar,
  SearchInput,
  Select,
  Tag,
  TextLink,
} from '../../components/index.js';
import { api } from '../../lib/api.js';
import { Pagination, RequestState } from '../shared/FeatureUI.jsx';
import { date, label, nameOf } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import { plural, REASONS, useAction } from './adminModel.js';
import { AdminPage, HistoryList, Message, SuspendDialog, UserStatusBadge } from './adminUI.jsx';
import styles from './Admin.module.css';

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
];
const ROLES = [
  { value: 'user', label: 'Player' },
  { value: 'admin', label: 'Admin' },
];
const roleLabel = (role) => (role === 'admin' ? 'Admin' : 'Player');
const joined = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

// User management (Figma 405:1571): search accounts, then open one to act on it.
export function UsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page, limit: 10 });
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (role) query.set('role', role);
  const users = useResource(`/admin/users?${query}`);
  const filter = (set) => (event) => {
    set(event.target.value);
    setPage(1);
  };
  return (
    <AdminPage
      title="User Management"
      lead="Community accounts"
      intro="Review member roles and take account-level moderation actions."
    >
      <div className={styles.filters}>
        <SearchInput
          label="Search users"
          placeholder="Search usernames or user IDs..."
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Select
          aria-label="Status"
          options={STATUSES}
          value={status}
          onChange={filter(setStatus)}
        />
        <Select
          aria-label="Role"
          options={[{ value: '', label: 'Any role' }, ...ROLES]}
          value={role}
          onChange={filter(setRole)}
        />
      </div>
      <RequestState resource={users}>
        {users.data?.items.length === 0 ? (
          <p className={styles.empty}>No accounts match.</p>
        ) : (
          users.data?.items.map((user) => (
            <article key={user.id} className={styles.item}>
              <div className={styles.stack}>
                <h3>{nameOf(user)}</h3>
                <p className={styles.muted}>
                  @{user.username} · {roleLabel(user.role)} · Joined{' '}
                  {joined.format(new Date(user.createdAt))} ·{' '}
                  {plural(user.stats.reviewsWritten, 'review')}
                  {user.openReportCount > 0 && ` · ${plural(user.openReportCount, 'open report')}`}
                </p>
              </div>
              <div className={styles.itemActions}>
                <UserStatusBadge status={user.status} />
                <Link to={`/admin/users/${user.id}`} className={styles.pillButton}>
                  Manage
                </Link>
              </div>
            </article>
          ))
        )}
        <Pagination data={users.data} page={page} setPage={setPage} />
      </RequestState>
      <section className={styles.card}>
        <h2>ACCOUNT ACTIONS</h2>
        <p className={styles.caption}>Available: Change Role • Suspend • Ban • Reinstate</p>
        <p className={styles.caption}>
          Open an account with Manage. Each action asks you to confirm.
        </p>
      </section>
    </AdminPage>
  );
}

// User detail (Figma 2010:1730).
export function UserDetailPage() {
  const { userId } = useParams();
  const user = useResource(`/admin/users/${userId}`);
  return (
    <AdminPage title="User Management">
      <TextLink as={Link} to="/admin/users">
        ‹ Back to User Management
      </TextLink>
      <RequestState resource={user}>
        {user.data && <UserDetail key={user.data.id} initial={user.data} />}
      </RequestState>
    </AdminPage>
  );
}

function UserDetail({ initial }) {
  const { me } = useOutletContext();
  const [user, setUser] = useState(initial);
  const [dialog, setDialog] = useState(false);
  const [done, setDone] = useState('');
  const [revision, setRevision] = useState(0);
  const action = useAction();
  const isSelf = me.id === user.id;
  const restricted = user.status !== 'active';
  // Reports filed against the account itself; reports on their content are in the report queue.
  const reports = useResource('/admin/reports?targetType=user&page=1&limit=50');
  const against = (reports.data?.items || []).filter((report) => report.target.id === user.id);

  function updated(next, message) {
    setUser(next);
    setDone(message);
    setDialog(false);
    setRevision((value) => value + 1);
  }
  const change = (message, request) => async () => {
    setDone('');
    await action.run(async () => updated(await request(), message));
  };
  const lift = change(`${nameOf(user)} can log in again.`, () =>
    api.post(`/admin/users/${user.id}/unsuspend`),
  );
  const setRole = (role) =>
    change(`${nameOf(user)} is now ${role === 'admin' ? 'an admin' : 'a player'}.`, () =>
      api.put(`/admin/users/${user.id}/role`, { role }),
    )();

  return (
    <>
      <section
        className={styles.card}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}
      >
        <InitialAvatar name={nameOf(user)} />
        <div className={styles.stack}>
          <h2 className={styles.heading2}>{nameOf(user)}</h2>
          <p className={styles.muted}>
            @{user.username} · joined {joined.format(new Date(user.createdAt))} · {user.email}
          </p>
          <div className={styles.row}>
            <Tag>{user.reputationPoints.toLocaleString('en-GB')} points</Tag>
            <span className={styles.caption}>
              {plural(user.stats.reviewsWritten, 'review')} written ·{' '}
              {plural(user.stats.gamesPublished, 'game')} published ·{' '}
              {plural(user.openReportCount, 'open report')}
            </span>
          </div>
          <TextLink as={Link} to={`/users/${user.username}`}>
            View public profile
          </TextLink>
        </div>
      </section>

      <Message error={action.error} success={done} />

      <div className={styles.halves}>
        <section className={styles.card}>
          <h3>Role</h3>
          <Select
            aria-label="Role"
            className={styles.start}
            options={ROLES}
            value={user.role}
            disabled={isSelf || action.busy}
            onChange={(event) => setRole(event.target.value)}
          />
          <p className={styles.caption}>
            {isSelf
              ? 'You can’t change your own role.'
              : 'Admins can moderate and change settings.'}
          </p>
        </section>

        <section className={styles.card}>
          <h3>Account</h3>
          <div className={styles.row}>
            <span className={styles.muted}>Status</span>
            <UserStatusBadge status={user.status} compact />
          </div>
          {restricted && user.suspension && (
            <p className={styles.caption}>
              {user.suspension.until ? `Until ${date(user.suspension.until)}` : 'Permanent ban'} · “
              {user.suspension.reason}”
            </p>
          )}
          <div className={styles.row}>
            {restricted ? (
              <Button disabled={action.busy} onClick={lift}>
                Lift {user.status === 'banned' ? 'ban' : 'suspension'}
              </Button>
            ) : user.role === 'admin' ? (
              <p className={styles.caption}>Admins can’t be suspended. Change the role first.</p>
            ) : (
              <Button disabled={action.busy} onClick={() => setDialog(true)}>
                Suspend or ban
              </Button>
            )}
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <h3>
          Reports against {nameOf(user)} ({against.length})
        </h3>
        {reports.loading ? (
          <p className={styles.caption}>Loading reports…</p>
        ) : reports.error ? (
          <p className={styles.caption}>Reports couldn’t be loaded.</p>
        ) : against.length === 0 ? (
          <p className={styles.caption}>No one has reported this account.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Reported by</th>
                <th scope="col">Reason</th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {against.map((report) => (
                <tr key={report.id}>
                  <td>
                    <TextLink as={Link} to={`/admin/reports/${report.id}`} state={{ report }}>
                      {nameOf(report.reporter)}
                    </TextLink>
                  </td>
                  <td>{REASONS[report.reason] || label(report.reason)}</td>
                  <td>{label(report.status)}</td>
                  <td>{date(report.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.card}>
        <h3>History</h3>
        <HistoryList
          key={revision}
          targetType="user"
          targetId={user.id}
          limit={10}
          empty="No actions on this account yet."
        />
      </section>

      {dialog && (
        <SuspendDialog
          user={user}
          onClose={() => setDialog(false)}
          onDone={(next) =>
            updated(
              next,
              `${nameOf(user)} is ${next.status === 'banned' ? 'banned' : 'suspended'}.`,
            )
          }
        />
      )}
    </>
  );
}
