import { useState } from 'react';
import { Link } from 'react-router';
import { Button, SearchInput, Select, TextLink } from '../../components/index.js';
import { api } from '../../lib/api.js';
import { Pagination, RequestState } from '../shared/FeatureUI.jsx';
import { label, nameOf } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import { internalLink, TARGETS, useAction, useKeptData } from './adminModel.js';
import { AdminPage, Badge, HistoryList, Message, ReasonDialog } from './adminUI.jsx';
import styles from './Admin.module.css';

const TYPES = [
  { value: '', label: 'All content' },
  { value: 'game', label: 'Games' },
  { value: 'review', label: 'Reviews' },
  { value: 'reply', label: 'Replies' },
];
const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
];
const TONES = { hidden: 'sunny', removed: 'pink' };

function reported(count) {
  if (!count) return 'No open reports';
  return `Reported ${count === 1 ? '1 time' : `${count} times`}`;
}

// Content moderation (Figma 405:1523): search games, reviews and replies, then hide or restore.
export function ContentPage() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [revision, setRevision] = useState(0);
  const [historySize, setHistorySize] = useState(5);
  const action = useAction();
  const query = new URLSearchParams({ page, limit: 10 });
  if (type) query.set('type', type);
  if (status) query.set('status', status);
  if (search) query.set('search', search);
  const content = useKeptData(useResource(`/admin/content?${query}`));
  const filter = (set) => (event) => {
    set(event.target.value);
    setPage(1);
  };
  function changed() {
    setDialog(null);
    setRevision((value) => value + 1);
    content.refresh();
  }
  const pathOf = (item) => `/admin/content/${item.type}/${item.id}`;
  const restore = (item) =>
    action.run(async () => {
      await api.post(`${pathOf(item)}/restore`);
      changed();
    });

  return (
    <AdminPage
      title="Content Moderation"
      lead="Content library"
      intro="Search published content, change visibility and restore hidden items."
    >
      <div className={styles.filters}>
        <SearchInput
          label="Search content"
          placeholder="Search by game, review or creator"
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Select aria-label="Content type" options={TYPES} value={type} onChange={filter(setType)} />
        <Select
          aria-label="Status"
          options={STATUSES}
          value={status}
          onChange={filter(setStatus)}
        />
      </div>
      <Message error={action.error} />
      <RequestState resource={content}>
        {content.data?.items.length === 0 ? (
          <p className={styles.empty}>Nothing matches these filters.</p>
        ) : (
          content.data?.items.map((item) => {
            const link = internalLink(item.link);
            return (
              <article key={`${item.type}-${item.id}`} className={styles.item}>
                <div className={styles.stack}>
                  <h3>
                    {item.title} — {TARGETS[item.type] || label(item.type)}
                  </h3>
                  <p className={styles.muted}>
                    by {nameOf(item.author)} · {reported(item.openReportCount)}
                    {item.lastAction && ' · Previously moderated'}
                  </p>
                  {item.excerpt && <p className={styles.caption}>“{item.excerpt}”</p>}
                  {item.status === 'hidden' && item.reason && (
                    <p className={styles.caption}>Hidden because: {item.reason}</p>
                  )}
                  {item.status !== 'removed' && (
                    <div className={styles.row}>
                      {link && (
                        <TextLink as={Link} size="sm" to={link}>
                          Open
                        </TextLink>
                      )}
                      <button
                        type="button"
                        className={styles.linkButton}
                        style={{ font: 'var(--playloop-type-body-small)' }}
                        onClick={() => setDialog({ kind: 'remove', item })}
                      >
                        Remove for good
                      </button>
                    </div>
                  )}
                </div>
                <div className={styles.itemActions}>
                  <Badge tone={TONES[item.status]}>{item.status}</Badge>
                  {item.status === 'visible' && (
                    <button
                      type="button"
                      className={styles.pillButton}
                      onClick={() => setDialog({ kind: 'hide', item })}
                    >
                      Hide
                    </button>
                  )}
                  {item.status === 'hidden' && (
                    <button
                      type="button"
                      className={styles.pillButton}
                      disabled={action.busy}
                      onClick={() => restore(item)}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
        <Pagination data={content.data} page={page} setPage={setPage} />
      </RequestState>

      <section className={styles.card}>
        <h2>MODERATION HISTORY</h2>
        <p className={styles.caption}>
          Hidden items stay searchable for admins. Restore or remove content only after reviewing
          its moderation history.
        </p>
        <HistoryList key={`${revision}-${historySize}`} limit={historySize} />
        {historySize < 50 && (
          <div className={styles.saveBar}>
            <Button onClick={() => setHistorySize(50)}>View history →</Button>
          </div>
        )}
      </section>

      {dialog?.kind === 'hide' && (
        <ReasonDialog
          title={`Hide “${dialog.item.title}”?`}
          note="It leaves Explore, Roulette and public lists. The author and admins can still open it."
          confirmLabel="Hide"
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await api.post(`${pathOf(dialog.item)}/hide`, { reason });
            changed();
          }}
        />
      )}
      {dialog?.kind === 'remove' && (
        <ReasonDialog
          title={`Remove this ${dialog.item.type} for good?`}
          note="This can’t be undone. Removing a review also reverses the reputation it earned."
          confirmLabel="Remove for good"
          needsReason={false}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await api.delete(pathOf(dialog.item));
            changed();
          }}
        />
      )}
    </AdminPage>
  );
}
