import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Select, Tab, TabList } from '../../components/index.js';
import { api } from '../../lib/api.js';
import {
  EmptyState,
  FeedbackBadge,
  PageHeader,
  Pagination,
  RequestState,
  Reviewer,
} from '../shared/FeatureUI.jsx';
import { date, label } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import { ReviewDetails } from '../reviews/ReviewDetails.jsx';
import { Discussion } from '../reviews/Discussion.jsx';
import styles from '../shared/Features.module.css';
const statuses = ['new', 'reviewed', 'planned', 'fixed'];

export function FeedbackInboxPage() {
  const { gameId } = useParams();
  return <Inbox key={gameId} gameId={gameId} />;
}
function Inbox({ gameId }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [gamePage, setGamePage] = useState(1);
  const games = useResource(`/me/games?page=${gamePage}&limit=100`);
  const game = useResource(`/games/${gameId}`);
  const resource = useResource(
    `/games/${gameId}/feedback?page=${page}&limit=10${filter === 'all' ? '' : `&status=${filter}`}`,
  );
  const selectedId = resource.data?.items.some((item) => item.id === selected)
    ? selected
    : resource.data?.items[0]?.id;
  const options = games.data?.items.map((g) => ({ value: g.id, label: `Game: ${g.title}` })) || [];
  if (!options.some((option) => option.value === gameId))
    options.unshift({ value: gameId, label: `Game: ${game.data?.title || 'Selected game'}` });
  return (
    <div className={styles.page}>
      <PageHeader title="FEEDBACK INBOX">
        <div className={styles.row}>
          <Select
            aria-label="Game"
            options={options}
            value={gameId}
            onChange={(e) => navigate(`/my-games/${e.target.value}/feedback`)}
          />
          <Link to="/my-games">My Games</Link>
        </div>
        <Pagination data={games.data} page={gamePage} setPage={setGamePage} />
      </PageHeader>
      <TabList label="Feedback status" className={styles.tabs}>
        {['all', ...statuses].map((status) => (
          <Tab
            key={status}
            selected={filter === status}
            onClick={() => {
              setFilter(status);
              setPage(1);
              setSelected(null);
            }}
          >
            {label(status)} {resource.data?.counts[status] ?? ''}
          </Tab>
        ))}
      </TabList>
      <RequestState resource={resource}>
        {resource.data?.items.length === 0 ? (
          <EmptyState>No {filter === 'all' ? '' : `${filter} `}feedback yet.</EmptyState>
        ) : (
          <div className={styles.inbox}>
            <aside className={styles.reviewList} aria-label="Reviews">
              {resource.data?.items.map((item) => (
                <button
                  key={item.id}
                  className={styles.inboxItem}
                  aria-pressed={selectedId === item.id}
                  onClick={() => setSelected(item.id)}
                >
                  <div className={styles.between}>
                    <Reviewer user={item.reviewer} subtitle={date(item.submittedAt)} size={48} />
                    <FeedbackBadge status={item.feedbackStatus} />
                  </div>
                  <p>{item.excerpt}</p>
                </button>
              ))}
              <Pagination
                data={resource.data}
                page={page}
                setPage={(next) => {
                  setPage(next);
                  setSelected(null);
                }}
              />
            </aside>
            {selectedId && (
              <InboxDetail
                key={selectedId}
                reviewId={selectedId}
                onStatusChange={resource.refresh}
              />
            )}
          </div>
        )}
      </RequestState>
    </div>
  );
}
function InboxDetail({ reviewId, onStatusChange }) {
  const resource = useResource(`/reviews/${reviewId}`);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function changeStatus(next) {
    setBusy(true);
    setError('');
    try {
      const result = await api.put(`/reviews/${reviewId}/feedback-status`, { status: next });
      setStatus(result.feedbackStatus);
      onStatusChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.detail}>
      <RequestState resource={resource}>
        {resource.data && (
          <>
            <Reviewer
              user={resource.data.reviewer}
              subtitle={`${date(resource.data.submittedAt)} · played ${Math.round((resource.data.playtest?.playedSeconds || 0) / 60)} min`}
            />
            <h2 className={styles.sectionTitle}>Feedback status</h2>
            <div className={styles.row}>
              {statuses.map((value) => (
                <button
                  className={styles.statusButton}
                  key={value}
                  aria-pressed={(status || resource.data.feedbackStatus) === value}
                  disabled={busy}
                  onClick={() => changeStatus(value)}
                >
                  {label(value)}
                </button>
              ))}
            </div>
            <p className={styles.caption}>The reviewer sees this status on their review.</p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <ReviewDetails review={resource.data} />
            <Button as={Link} variant="glass" to={`/reviews/${reviewId}`}>
              Open public review
            </Button>
            <Discussion reviewId={reviewId} compact />
          </>
        )}
      </RequestState>
    </div>
  );
}
