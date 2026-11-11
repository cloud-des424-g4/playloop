import { useState } from 'react';
import { SearchInput, Select } from '../../components/index.js';
import { api } from '../../lib/api.js';
import { Pagination, RequestState } from '../shared/FeatureUI.jsx';
import { label } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import { plural, useAction, useKeptData } from './adminModel.js';
import { AdminPage, Badge, Message } from './adminUI.jsx';
import styles from './Admin.module.css';

const MAX_FEATURED = 10;
const SORTS = [
  { value: 'recent', label: 'Recent activity' },
  { value: 'playtests', label: 'Most playtests' },
  { value: 'reviews', label: 'Most reviews' },
];

// Featured games (Figma 410:1481): shortlist by activity, then choose and order what to feature.
export function FeaturedPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const action = useAction();
  const query = new URLSearchParams({ page, limit: 10, sort });
  if (search) query.set('search', search);
  const featured = useKeptData(useResource('/admin/featured'));
  const games = useKeptData(useResource(`/admin/games?${query}`));
  const list = featured.data?.items || [];
  const ids = list.map((game) => game.id);
  const full = ids.length >= MAX_FEATURED;

  const save = (gameIds) =>
    action.run(async () => {
      await api.put('/admin/featured', { gameIds });
      featured.refresh();
      games.refresh();
    });
  const toggle = (id) => save(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  function move(index, by) {
    const next = [...ids];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    save(next);
  }

  return (
    <AdminPage
      title="Featured Games"
      lead="Curate discoverability"
      intro="Use playtest activity to shortlist games, then choose what to feature."
    >
      <Message error={action.error} />

      <section className={styles.card}>
        <h2>
          FEATURED NOW ({ids.length}/{MAX_FEATURED})
        </h2>
        {featured.loading ? (
          <p className={styles.caption}>Loading…</p>
        ) : featured.error ? (
          <p className={styles.caption}>The featured list couldn’t be loaded.</p>
        ) : list.length === 0 ? (
          <p className={styles.caption}>Nothing is featured yet. Pick games from the list below.</p>
        ) : (
          <ol
            className={`${styles.stack} ${styles.divided}`}
            style={{ listStyle: 'none', gap: 16 }}
          >
            {list.map((game, index) => (
              <li key={game.id} className={styles.between}>
                <span className={styles.body19}>
                  {index + 1}. {game.title}
                </span>
                <span className={styles.row}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    aria-label={`Move ${game.title} up`}
                    disabled={index === 0 || action.busy}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    aria-label={`Move ${game.title} down`}
                    disabled={index === list.length - 1 || action.busy}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    aria-label={`Unfeature ${game.title}`}
                    disabled={action.busy}
                    onClick={() => toggle(game.id)}
                  >
                    Unfeature
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className={styles.filters}>
        <SearchInput
          label="Search games"
          placeholder="Search games"
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Select
          aria-label="Sort by"
          options={SORTS}
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <RequestState resource={games}>
        {games.data?.items.length === 0 ? (
          <p className={styles.empty}>No published games match.</p>
        ) : (
          games.data?.items.map(({ game, playtestCount, openReportCount }) => {
            const isFeatured = ids.includes(game.id);
            return (
              <article key={game.id} className={styles.item}>
                <div className={styles.stack}>
                  <h3>{game.title}</h3>
                  <p className={styles.muted}>
                    {game.genres?.[0] ? `${label(game.genres[0])} · ` : ''}
                    {plural(playtestCount, 'playtest')} · {plural(game.reviewCount ?? 0, 'review')}{' '}
                    · {plural(openReportCount, 'report')}
                  </p>
                </div>
                <div className={styles.itemActions}>
                  <Badge tone={isFeatured ? 'lime' : undefined}>
                    {isFeatured ? 'Featured' : 'Candidate'}
                  </Badge>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${isFeatured ? styles.quiet : ''}`}
                    aria-label={`${isFeatured ? 'Unfeature' : 'Feature'} ${game.title}`}
                    disabled={action.busy || featured.loading || (!isFeatured && full)}
                    onClick={() => toggle(game.id)}
                  >
                    {isFeatured ? 'Unfeature' : 'Feature'}
                  </button>
                </div>
              </article>
            );
          })
        )}
        <Pagination data={games.data} page={page} setPage={setPage} />
      </RequestState>

      <section className={styles.card}>
        <h2>CURATION GUIDELINES</h2>
        <p className={styles.caption}>Popularity is not the same as positive player feedback.</p>
        <p className={styles.caption}>
          Balance active games with new indie games needing testers. Up to {MAX_FEATURED} games can
          be featured.
        </p>
      </section>
    </AdminPage>
  );
}
