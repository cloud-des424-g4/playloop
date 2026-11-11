import { useState } from 'react';
import { Link } from 'react-router';
import { Button, GlassPanel, PrimaryButton, Tag } from '../../components/index.js';
import { useResource } from '../shared/useResource.js';
import { EmptyState, PageHeader, Pagination, RequestState } from '../shared/FeatureUI.jsx';
import { date, label } from '../shared/format.js';
import publish from '../../assets/features/publish.png';
import styles from '../shared/Features.module.css';

export function MyGamesPage() {
  const [page, setPage] = useState(1);
  const resource = useResource(`/me/games?page=${page}&limit=12`);
  const summary = resource.data?.summary;
  return (
    <div className={styles.page}>
      <PageHeader
        title="MY GAMES"
        action={
          <Link className={styles.publish} to="/my-games/new">
            Publish
            <br />
            Game
            <img src={publish} alt="" />
          </Link>
        }
      >
        {summary && (
          <div className={styles.row}>
            <Tag tone="lime">{summary.published} published</Tag>
            <Tag>
              {summary.drafts} draft{summary.drafts === 1 ? '' : 's'}
            </Tag>
            <Tag>{summary.reviewsReceived} reviews received</Tag>
          </div>
        )}
      </PageHeader>
      <RequestState resource={resource}>
        {resource.data?.items.length === 0 && (
          <EmptyState>
            <p>Your next playtest starts here.</p>
            <p>Create a game and build a feedback form for your players.</p>
          </EmptyState>
        )}
        <div className={styles.gameGrid}>
          {resource.data?.items.map((game) => (
            <GlassPanel as="article" key={game.id} className={styles.gameCard}>
              <div className={styles.between}>
                <div className={styles.row}>
                  <Tag tone={game.status === 'published' ? 'lime' : 'neutral'}>
                    {label(game.status)}
                  </Tag>
                  {game.buildStage && <Tag>{label(game.buildStage)}</Tag>}
                  {game.engine && <Tag>{label(game.engine)}</Tag>}
                </div>
                {game.newReviewCount > 0 && (
                  <Tag tone="sunny">{game.newReviewCount} new reviews</Tag>
                )}
              </div>
              {game.coverUrl ? (
                <img
                  className={styles.cover}
                  src={game.coverUrl}
                  alt={`${game.title} screenshot`}
                />
              ) : (
                <div className={`${styles.cover} ${styles.emptyCover}`}>
                  <span>No screenshots yet</span>
                  <span className={styles.caption}>Add at least one to publish</span>
                </div>
              )}
              <h2>{game.title}</h2>
              <p>{game.pitch}</p>
              <p className={styles.caption}>
                {game.reviewCount} reviews · Updated {date(game.updatedAt)}
              </p>
              <div className={styles.row}>
                {game.status === 'draft' ? (
                  <PrimaryButton size="md" as={Link} to={`/my-games/${game.id}/edit`}>
                    Continue editing
                  </PrimaryButton>
                ) : (
                  <Button as={Link} variant="glass" to={`/my-games/${game.id}/edit`}>
                    Edit game
                  </Button>
                )}
                <Button as={Link} variant="glass" to={`/my-games/${game.id}/feedback`}>
                  Feedback inbox
                </Button>
                <Button as={Link} variant="glass" to={`/my-games/${game.id}/form`}>
                  PlayLoop form
                </Button>
                <Link to={`/games/${game.id}/reviews`}>Reviews &amp; discussion</Link>
              </div>
            </GlassPanel>
          ))}
        </div>
        <Pagination data={resource.data} page={page} setPage={setPage} />
      </RequestState>
    </div>
  );
}
