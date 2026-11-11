import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, GlassPanel, Select, Tag } from '../../components/index.js';
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
import { ReviewDetails } from './ReviewDetails.jsx';
import { Discussion } from './Discussion.jsx';
import up from '../../assets/features/thumb-up.svg';
import down from '../../assets/features/thumb-down.svg';
import discussion from '../../assets/features/discussion.svg';
import users from '../../assets/features/users.svg';
import styles from '../shared/Features.module.css';

export function ReviewsPage() {
  const { gameId } = useParams();
  const [sort, setSort] = useState('helpful');
  const [page, setPage] = useState(1);
  const game = useResource(`/games/${gameId}`);
  const reviews = useResource(`/games/${gameId}/reviews?sort=${sort}&page=${page}&limit=10`);
  return (
    <div className={styles.page}>
      <PageHeader title="REVIEWS & DISCUSSION" />
      <RequestState resource={game}>
        {game.data && <GameSummary game={game.data} total={reviews.data?.total} />}
      </RequestState>
      <div className={styles.between}>
        <h2 className={styles.sectionTitle}>COMMUNITY REVIEWS</h2>
        <Select
          aria-label="Sort reviews"
          options={[
            { value: 'helpful', label: 'Most Helpful' },
            { value: 'newest', label: 'Newest' },
          ]}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <RequestState resource={reviews}>
        {reviews.data?.items.length === 0 && (
          <EmptyState>No reviews yet. Be the first to playtest this game.</EmptyState>
        )}
        {reviews.data?.items.map((review) => (
          <CommunityReview key={`${sort}-${page}-${review.id}`} initial={review} />
        ))}
        <Pagination data={reviews.data} page={page} setPage={setPage} />
      </RequestState>
    </div>
  );
}
function GameSummary({ game, total }) {
  const cover = game.coverUrl || game.media?.find((m) => m.type === 'image')?.url;
  return (
    <GlassPanel className={styles.gameSummary}>
      {cover ? (
        <img src={cover} alt={`${game.title} cover`} />
      ) : (
        <div className={`${styles.cover} ${styles.emptyCover}`}>No screenshot</div>
      )}
      <div className={styles.stack}>
        <h2>{game.title}</h2>
        <div className={styles.row}>
          {game.genres?.map((genre) => (
            <Tag key={genre} tone="sky">
              {label(genre)}
            </Tag>
          ))}
          {game.engine && <Tag>{label(game.engine)}</Tag>}
          {game.platforms?.map((platform) => (
            <Tag key={platform}>{label(platform)}</Tag>
          ))}
        </div>
        <p>{game.pitch}</p>
        <div className={styles.row}>
          <Tag tone="lilac">{total ?? game.reviewCount ?? 0} Reviews</Tag>
          <span className={styles.row}>
            <img src={users} alt="" />
            <Tag tone="pink">Community feedback</Tag>
          </span>
        </div>
      </div>
    </GlassPanel>
  );
}
function CommunityReview({ initial, expanded = false }) {
  const [review, setReview] = useState(initial);
  const [showDetails, setShowDetails] = useState(expanded);
  const [showDiscussion, setShowDiscussion] = useState(expanded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const detail = useResource(showDetails && !review.form ? `/reviews/${review.id}` : null);
  async function vote(value) {
    setBusy(true);
    setError('');
    try {
      const result =
        review.myVote === value
          ? await api.delete(`/reviews/${review.id}/vote`)
          : await api.put(`/reviews/${review.id}/vote`, { value });
      setReview((current) => ({ ...current, ...result }));
    } catch (err) {
      setError(err.status === 401 ? 'Log in to vote on reviews.' : err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.stack}>
      <GlassPanel as="article" className={styles.reviewCard}>
        <div className={styles.between}>
          <Reviewer
            user={review.reviewer}
            subtitle={`Level ${review.reviewer?.level || 1} Reviewer · ${date(review.submittedAt)}`}
            size={96}
          />
          <FeedbackBadge status={review.feedbackStatus} />
        </div>
        <h3 className={styles.sectionTitle}>Final Verdict</h3>
        <p>{review.finalVerdict?.changeText}</p>
        <h3 className={styles.sectionTitle}>Suggested Improvement</h3>
        <p>{review.finalVerdict?.improveText}</p>
        <div className={styles.between}>
          <Link to={`/reviews/${review.id}`}>View Full Review ↗</Link>
          <span className={styles.caption}>{review.replyCount} Replies</span>
        </div>
        <div className={styles.reviewActions}>
          <button
            className={styles.action}
            disabled={busy || review.isReviewer}
            aria-pressed={review.myVote === 1}
            onClick={() => vote(1)}
          >
            <img src={up} alt="" />
            Helpful ({review.helpfulCount})
          </button>
          <button
            className={styles.action}
            disabled={busy || review.isReviewer}
            aria-pressed={review.myVote === -1}
            onClick={() => vote(-1)}
          >
            <img src={down} alt="" />
            Not Helpful ({review.notHelpfulCount})
          </button>
          <button
            className={styles.action}
            aria-expanded={showDiscussion}
            onClick={() => setShowDiscussion(!showDiscussion)}
          >
            <img src={discussion} alt="" />
            Discussion
          </button>
          <Button
            variant="glass"
            aria-expanded={showDetails}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Full Review' : 'View Full Review'}
          </Button>
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {showDetails && (
          <RequestState resource={detail}>
            {(review.form || detail.data) && (
              <ReviewDetails review={review.form ? review : detail.data} />
            )}
          </RequestState>
        )}
      </GlassPanel>
      {showDiscussion && (
        <Discussion
          key={review.id}
          reviewId={review.id}
          onReply={() =>
            setReview((current) => ({ ...current, replyCount: current.replyCount + 1 }))
          }
        />
      )}
    </section>
  );
}
export function PublishedReviewPage() {
  const { reviewId } = useParams();
  const resource = useResource(`/reviews/${reviewId}`);
  return (
    <div className={styles.page}>
      <PageHeader title="REVIEWS & DISCUSSION" />
      <RequestState resource={resource}>
        {resource.data && (
          <>
            <GameSummary game={resource.data.game} />
            <Link to={`/games/${resource.data.game.id}/reviews`}>See all reviews</Link>
            <CommunityReview key={reviewId} initial={resource.data} expanded />
          </>
        )}
      </RequestState>
    </div>
  );
}
