import { useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Button,
  GameCard,
  Recommendation,
  SearchInput,
  Tab,
  TabList,
  Tag,
} from '../../components/index.js';
import { toneForGenre } from '../../lib/tagTones.js';
import { cx } from '../../lib/cx.js';
import { useResource } from '../shared/useResource.js';
import { EmptyState, Pagination, RequestState } from '../shared/FeatureUI.jsx';
import {
  FALLBACK_OPTIONS,
  clearFilters,
  gamesPath,
  hasFilters,
  optionLabel,
  pageOf,
  sortOf,
  toggleFilter,
  withParam,
} from './exploreQuery.js';
import lettering from '../../assets/auth/playloop-lettering.png';
import heroBlob from '../../assets/explore/hero-blob.svg';
import roulette from '../../assets/auth/bubble-roulette.png';
import publish from '../../assets/features/publish.png';
import { cardTags } from '../games/gameLabels.js';
import styles from './ExplorePage.module.css';

// GET /games has no "upcoming" sort yet, so that tab is shown but disabled.
const SORT_TABS = [
  { sort: 'newest', label: 'New Releases' },
  { sort: 'popular', label: 'Popular' },
];

// Explore Games, the home screen. Figma: browse games (47:27).
export function ExplorePage() {
  const id = useId();
  const [params, setParams] = useSearchParams();
  const games = useResource(gamesPath(params));
  const recommendations = useResource('/recommendations?limit=3');
  const meta = useResource('/meta');
  const me = useResource('/me');

  const options = meta.data ?? (meta.error ? FALLBACK_OPTIONS : null);
  const genreLabels = new Map(options?.genres.map(({ key, label }) => [key, label]));
  const genreLabel = (key) => genreLabels.get(key) ?? optionLabel(key);
  const sort = sortOf(params);
  const search = params.get('search') ?? '';
  const items = games.data?.items;
  const tabId = (value) => `${id}-sort-${value}`;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.art} aria-hidden="true">
          <img className={styles.blob} src={heroBlob} alt="" />
          <img className={styles.lettering} src={lettering} alt="" />
        </div>
        <h1 className={styles.tagline}>
          Play games.
          <br />
          Get played.
        </h1>
        <p className={styles.pitch}>
          Test other indie games and get real feedback on yours. Every player is a developer, every
          developer is a reviewer.
        </p>
        <nav aria-label="Quick start" className={styles.shortcuts}>
          <Link to="/roulette" className={cx(styles.bubble, styles.roulette)}>
            <span className={styles.bubbleLabel}>
              Playtest
              <br />
              Roulette
            </span>
            <img src={roulette} alt="" />
          </Link>
          <Link to="/my-games/new" className={cx(styles.bubble, styles.publish)}>
            <span className={styles.bubbleLabel}>
              Publish
              <br />
              Game
            </span>
            <img src={publish} alt="" />
          </Link>
        </nav>
      </header>

      <section className={styles.browser} aria-labelledby={`${id}-games`}>
        <div className={styles.head}>
          <h2 id={`${id}-games`} className={styles.gamesTab}>
            GAMES
          </h2>
          <SearchInput
            key={search}
            defaultValue={search}
            className={styles.search}
            onSearch={(query) => setParams(withParam(params, 'search', query))}
          />
        </div>

        <div className={styles.panel}>
          <div className={styles.bar}>
            <TabList label="Sort games" className={styles.tabs}>
              {SORT_TABS.map((tab) => (
                <Tab
                  key={tab.sort}
                  id={tabId(tab.sort)}
                  aria-controls={`${id}-results`}
                  selected={sort === tab.sort}
                  onClick={() =>
                    setParams(withParam(params, 'sort', tab.sort === 'newest' ? null : tab.sort))
                  }
                >
                  {tab.label}
                </Tab>
              ))}
              <Tab disabled title="Upcoming games are not available yet">
                Upcoming
              </Tab>
            </TabList>
          </div>

          <aside className={styles.sidebar} aria-label="Recommendations and filters">
            <section className={styles.sideSection} aria-labelledby={`${id}-recommendations`}>
              <h3 id={`${id}-recommendations`} className={styles.sideTitle}>
                Recommendations
              </h3>
              <Recommendations resource={recommendations} genreLabel={genreLabel} />
            </section>

            <section className={styles.categories} aria-labelledby={`${id}-categories`}>
              <h3 id={`${id}-categories`} className={styles.sideTitle}>
                Categories
              </h3>
              {options ? (
                <div className={styles.groups}>
                  {me.data?.favoriteGenres?.length > 0 && (
                    <FilterGroup
                      title="Your Top Categories"
                      name="genre"
                      values={me.data.favoriteGenres}
                      labelFor={genreLabel}
                      toneFor={toneForGenre}
                      params={params}
                      onChange={setParams}
                    />
                  )}
                  <FilterGroup
                    title="All Genres & Themes"
                    name="genre"
                    values={options.genres.map(({ key }) => key)}
                    labelFor={genreLabel}
                    toneFor={toneForGenre}
                    params={params}
                    onChange={setParams}
                  />
                  <FilterGroup
                    title="Platforms"
                    name="platform"
                    values={options.platforms}
                    labelFor={optionLabel}
                    params={params}
                    onChange={setParams}
                  />
                  <FilterGroup
                    title="Build Stage"
                    name="buildStage"
                    values={options.buildStages}
                    labelFor={optionLabel}
                    params={params}
                    onChange={setParams}
                  />
                </div>
              ) : (
                <p className={styles.caption}>Loading filters…</p>
              )}
            </section>
          </aside>

          <div
            role="tabpanel"
            id={`${id}-results`}
            aria-labelledby={tabId(sort)}
            className={styles.results}
          >
            <div className={styles.grid}>
              {(games.loading || games.error) && (
                <div className={cx(styles.cell, styles.wide)}>
                  <RequestState resource={games} />
                </div>
              )}
              {items?.length === 0 && (
                <div className={cx(styles.cell, styles.wide)}>
                  <EmptyState>
                    <p>
                      {hasFilters(params)
                        ? 'No games match your search and filters.'
                        : 'No games have been published yet.'}
                    </p>
                    {hasFilters(params) && (
                      <Button
                        variant="glass"
                        className={styles.clear}
                        onClick={() => setParams(clearFilters(params))}
                      >
                        Clear filters
                      </Button>
                    )}
                  </EmptyState>
                </div>
              )}
              {items?.map((game) => (
                <div key={game.id} className={styles.cell}>
                  <GameCard
                    as={Link}
                    to={`/games/${game.id}`}
                    title={game.title}
                    description={game.pitch}
                    coverSrc={game.coverUrl ?? undefined}
                    coverAlt={`${game.title} cover`}
                    tags={cardTags(game, genreLabel)}
                  />
                </div>
              ))}
            </div>
            <Pagination
              data={games.data}
              page={pageOf(params)}
              setPage={(page) => setParams(withParam(params, 'page', page > 1 && String(page)))}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Recommendations({ resource, genreLabel }) {
  if (resource.loading) return <p className={styles.caption}>Loading…</p>;
  if (resource.error) {
    return <p className={styles.caption}>Recommendations are unavailable right now.</p>;
  }
  if (resource.data.items.length === 0) {
    return <p className={styles.caption}>No recommendations for you yet.</p>;
  }
  return (
    <ul className={styles.recommendations}>
      {resource.data.items.map((game) => {
        const [genre] = game.genres;
        return (
          <li key={game.id}>
            <Recommendation
              as={Link}
              to={`/games/${game.id}`}
              title={game.title}
              metadata={[genre && genreLabel(genre), optionLabel(game.engine)]
                .filter(Boolean)
                .join(' - ')}
              tone={toneForGenre(genre)}
              coverSrc={game.coverUrl ?? undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

// Tag-shaped toggle buttons; each one adds or removes a value of a GET /games filter.
function FilterGroup({ title, name, values, labelFor, toneFor, params, onChange }) {
  const id = useId();
  const selected = params.getAll(name);
  return (
    <div className={styles.group}>
      <h4 id={id} className={styles.groupTitle}>
        {title}
      </h4>
      <ul className={styles.chips} aria-labelledby={id}>
        {values.map((value) => {
          const pressed = selected.includes(value);
          return (
            <li key={value}>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={pressed}
                onClick={() => onChange(toggleFilter(params, name, value))}
              >
                <Tag tone={toneFor?.(value)} className={cx(pressed && styles.chipSelected)}>
                  {labelFor(value)}
                </Tag>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
