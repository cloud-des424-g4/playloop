import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  BadgeList,
  Button,
  GameCard,
  GlassPanel,
  ProfileHeader,
  ReviewCard,
  Tab,
  TabList,
  TextLink,
} from '../../components/index.js';
import { api } from '../../lib/api.js';
import { toneForGenre } from '../../lib/tagTones.js';
import { optionLabel } from '../explore/exploreQuery.js';
import { cardTags } from '../games/gameLabels.js';
import { RequestState } from '../shared/FeatureUI.jsx';
import { date } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import styles from './Profile.module.css';

const PAGE_SIZE = 6;

// Figma has three badge icons; the API has eight badges. Each badge uses the closest icon.
const BADGE_ICONS = {
  first_launch: 'launch',
  roulette_regular: 'launch',
  helping_hand: 'heart',
  hall_of_fame: 'heart',
};

const TABS = [
  ['games', 'Published Games'],
  ['reviews', 'Reviews'],
];

const hostOf = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// Public profile. Figma: "public profile (Tab Published Games)" (210:225) and "(Tab Reviews)"
// (210:262). The tab lives in the URL (?tab=reviews).
export function ProfilePage() {
  const { username } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'reviews' ? 'reviews' : 'games';
  const profile = useResource(`/users/${username}`);
  return (
    <RequestState resource={profile}>
      {profile.data && (
        <Profile
          key={username}
          profile={profile.data}
          tab={tab}
          onTab={(next) => setParams(next === 'games' ? {} : { tab: next }, { replace: true })}
        />
      )}
    </RequestState>
  );
}

function Profile({ profile, tab, onTab }) {
  const { reputation, stats } = profile;
  const [website] = profile.links;
  return (
    <div className={styles.page}>
      <ProfileHeader
        displayName={profile.displayName}
        pronouns={profile.pronouns}
        username={profile.username}
        avatarUrl={profile.avatarUrl}
        level={reputation.level}
        levelTitle={reputation.title}
        points={reputation.points}
        nextLevelPoints={reputation.nextLevelMinPoints}
        bio={profile.bio}
        stats={[
          { value: stats.reviewsWritten, label: 'Reviews written' },
          { value: stats.gamesPublished, label: 'Games published' },
          { value: stats.helpfulVotes, label: 'Helpful votes' },
        ]}
        tags={[
          ...profile.favoriteGenres.map((genre) => ({
            label: optionLabel(genre),
            tone: toneForGenre(genre),
          })),
          ...profile.platforms.map((platform) => ({ label: optionLabel(platform) })),
        ]}
        website={website && { href: website.url, label: hostOf(website.url) }}
        action={
          profile.isMe && (
            <Button variant="glass" as={Link} to="/settings/profile">
              Edit Profile
            </Button>
          )
        }
      />
      <BadgeList
        badges={profile.badges.map((badge) => ({
          title: badge.name,
          detail: badge.description,
          icon: BADGE_ICONS[badge.key] ?? 'review',
        }))}
      />
      <GlassPanel variant="panel" className={styles.panel}>
        <div className={styles.panelHead}>
          <TabList label="Profile sections">
            {TABS.map(([key, title]) => (
              <Tab
                key={key}
                id={`profile-tab-${key}`}
                aria-controls="profile-panel"
                selected={tab === key}
                onClick={() => onTab(key)}
              >
                {title}
              </Tab>
            ))}
          </TabList>
        </div>
        <div role="tabpanel" id="profile-panel" aria-labelledby={`profile-tab-${tab}`}>
          {tab === 'games' ? (
            <GamesTab username={profile.username} />
          ) : (
            <ReviewsTab username={profile.username} />
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

// Loads pages of a list and appends them ("Load more reviews"). Like useResource, state only
// changes when a request finishes.
function usePagedList(path) {
  const [count, setCount] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, pages: [], error: null });
  const key = `${count}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    api.get(`${path}?page=${count}&limit=${PAGE_SIZE}`, { signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted) return;
        setResult((current) => ({
          key,
          error: null,
          pages: [...current.pages.slice(0, count - 1), data],
        }));
      },
      (error) => {
        if (!controller.signal.aborted) setResult((current) => ({ ...current, key, error }));
      },
    );
    return () => controller.abort();
  }, [path, count, key]);
  const items = result.pages.flatMap((page) => page.items);
  const total = result.pages.at(-1)?.total ?? null;
  return {
    items,
    total,
    page: result.pages.length,
    loading: result.key !== key,
    error: result.key === key ? result.error : null,
    hasMore: total !== null && items.length < total,
    more: () => setCount((n) => n + 1),
    refresh: () => setAttempt((n) => n + 1),
  };
}

function ListFooter({ list, noun }) {
  if (list.total === null) return null;
  return (
    <div className={styles.footer}>
      <p className={styles.caption}>
        Showing {list.items.length} of {list.total} {noun}
      </p>
      {list.hasMore && (
        <Button variant="glass" disabled={list.loading} onClick={list.more}>
          {list.loading ? 'Loading…' : `Load more ${noun}`}
        </Button>
      )}
    </div>
  );
}

function GamesTab({ username }) {
  const list = usePagedList(`/users/${username}/games`);
  return (
    <RequestState resource={{ ...list, loading: list.loading && list.page === 0 }}>
      <p className={styles.count}>
        {list.total} game{list.total === 1 ? '' : 's'}
      </p>
      {list.total === 0 ? (
        <p className={styles.empty}>No published games yet.</p>
      ) : (
        <div className={styles.games}>
          {list.items.map((game) => (
            <GameCard
              key={game.id}
              as={Link}
              to={`/games/${game.id}`}
              title={game.title}
              description={game.pitch}
              coverSrc={game.coverUrl ?? undefined}
              coverAlt={`${game.title} cover`}
              tags={cardTags(game)}
            />
          ))}
        </div>
      )}
      {list.total > list.items.length && <ListFooter list={list} noun="games" />}
    </RequestState>
  );
}

function ReviewsTab({ username }) {
  const list = usePagedList(`/users/${username}/reviews`);
  return (
    <RequestState resource={{ ...list, loading: list.loading && list.page === 0 }}>
      <p className={styles.count}>
        {list.total} review{list.total === 1 ? '' : 's'}
      </p>
      {list.total === 0 ? (
        <p className={styles.empty}>No reviews yet.</p>
      ) : (
        <div className={styles.reviews}>
          {list.items.map((review) => (
            <ReviewCard
              key={review.id}
              title={review.game.title}
              date={date(review.submittedAt)}
              summary={review.excerpt}
              helpful={`${review.helpfulCount} found this helpful`}
              coverSrc={review.game.coverUrl ?? undefined}
              coverAlt={`${review.game.title} cover`}
              action={
                <span className={styles.reviewLinks}>
                  <TextLink as={Link} to={`/reviews/${review.id}`}>
                    Read review
                  </TextLink>
                  {!review.game.deleted && (
                    <TextLink as={Link} to={`/games/${review.game.id}`}>
                      View game ↗
                    </TextLink>
                  )}
                </span>
              }
            />
          ))}
        </div>
      )}
      <ListFooter list={list} noun="reviews" />
    </RequestState>
  );
}
