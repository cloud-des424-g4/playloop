import { useState } from 'react';
import { Button, Checkbox, PrimaryButton } from '../../components/index.js';
import { api } from '../../lib/api.js';
import { RequestState } from '../shared/FeatureUI.jsx';
import { date, label } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import { useAction } from './adminModel.js';
import { AdminPage, Message } from './adminUI.jsx';
import { configPatch, configProblem, GENRE_KEY, number } from './configModel.js';
import styles from './Admin.module.css';

const POINTS = [
  ['helpfulVote', 'Helpful vote on a review'],
  ['notHelpfulVote', 'Not-helpful vote on a review'],
  ['feedbackPlanned', 'Developer marks feedback Planned'],
  ['feedbackFixed', 'Developer marks feedback Fixed'],
];

// Configuration (Figma 410:1529 is a copy of the dashboard, so this follows GET /admin/config):
// genres, levels, badges and reputation points.
export function ConfigPage() {
  const config = useResource('/admin/config');
  return (
    <AdminPage
      title="Configuration"
      lead="Platform-wide preferences"
      intro="Adjust shared rules without changing individual games or users."
    >
      <RequestState resource={config}>
        {config.data && <Editor key={config.data.updatedAt} initial={config.data} />}
      </RequestState>
    </AdminPage>
  );
}

function Editor({ initial }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [newGenre, setNewGenre] = useState({ key: '', label: '' });
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState('');
  const action = useAction();
  const patch = configPatch(saved, draft);
  const dirty = Object.keys(patch).length > 0;

  const edit = (section, index, change) =>
    setDraft((current) => ({
      ...current,
      [section]: current[section].map((item, i) => (i === index ? { ...item, ...change } : item)),
    }));
  const genreKeyTaken = draft.genres.some((genre) => genre.key === newGenre.key);
  const canAddGenre = GENRE_KEY.test(newGenre.key) && newGenre.label.trim() && !genreKeyTaken;
  function addGenre() {
    setDraft((current) => ({
      ...current,
      genres: [
        ...current.genres,
        { key: newGenre.key, label: newGenre.label.trim(), active: true },
      ],
    }));
    setNewGenre({ key: '', label: '' });
  }
  function addLevel() {
    setDraft((current) => {
      const last = current.levels[current.levels.length - 1];
      return {
        ...current,
        levels: [
          ...current.levels,
          {
            level: last.level + 1,
            title: `Level ${last.level + 1}`,
            minPoints: last.minPoints + 500,
          },
        ],
      };
    });
  }
  async function save() {
    setDone('');
    const found = configProblem(draft);
    setProblem(found);
    if (found) return;
    await action.run(async () => {
      const next = await api.patch('/admin/config', patch);
      setSaved(next);
      setDraft(next);
      setDone('Saved.');
    });
  }

  return (
    <>
      <section className={styles.card}>
        <div>
          <h2>GENRES</h2>
          <p className={styles.caption}>
            Developers pick from the active ones. Turning a genre off keeps it on games that already
            use it; keys can’t be renamed or deleted.
          </p>
        </div>
        {draft.genres.map((genre, index) => (
          <div key={genre.key} className={styles.configRow}>
            <input
              className={styles.input}
              aria-label={`Name of genre ${genre.key}`}
              maxLength={30}
              value={genre.label}
              onChange={(event) => edit('genres', index, { label: event.target.value })}
            />
            <label className={styles.check}>
              <Checkbox
                checked={genre.active}
                onChange={(event) => edit('genres', index, { active: event.target.checked })}
              />
              Active
            </label>
          </div>
        ))}
        <div className={styles.addRow}>
          <input
            className={styles.input}
            aria-label="New genre key"
            placeholder="key, e.g. tower_defense"
            maxLength={30}
            value={newGenre.key}
            onChange={(event) =>
              setNewGenre({ ...newGenre, key: event.target.value.toLowerCase() })
            }
          />
          <input
            className={styles.input}
            aria-label="New genre name"
            placeholder="Name"
            maxLength={30}
            value={newGenre.label}
            onChange={(event) => setNewGenre({ ...newGenre, label: event.target.value })}
          />
          <Button
            variant="glass"
            disabled={!canAddGenre || draft.genres.length >= 50}
            onClick={addGenre}
          >
            + Add
          </Button>
        </div>
        {newGenre.key && !GENRE_KEY.test(newGenre.key) && (
          <p className={styles.caption}>Keys use 2–30 lowercase letters, numbers or underscores.</p>
        )}
        {genreKeyTaken && <p className={styles.caption}>That key is already used.</p>}
      </section>

      <section className={styles.card}>
        <div>
          <h2>LEVELS</h2>
          <p className={styles.caption}>
            Saving level changes recalculates everyone’s level. Level 1 starts at 0 points.
          </p>
        </div>
        {draft.levels.map((level, index) => (
          <div key={level.level} className={styles.levelRow}>
            <span className={styles.body19}>Level {level.level}</span>
            <input
              className={styles.input}
              aria-label={`Title of level ${level.level}`}
              maxLength={30}
              value={level.title}
              onChange={(event) => edit('levels', index, { title: event.target.value })}
            />
            <input
              className={styles.input}
              type="number"
              min={0}
              aria-label={`Points needed for level ${level.level}`}
              value={level.minPoints}
              disabled={index === 0}
              onChange={(event) => edit('levels', index, { minPoints: number(event.target.value) })}
            />
          </div>
        ))}
        <div className={styles.row}>
          <Button variant="glass" disabled={draft.levels.length >= 20} onClick={addLevel}>
            + Add a level
          </Button>
          <Button
            variant="glass"
            disabled={draft.levels.length <= 1}
            onClick={() =>
              setDraft((current) => ({ ...current, levels: current.levels.slice(0, -1) }))
            }
          >
            Remove the last level
          </Button>
        </div>
      </section>

      <section className={styles.card}>
        <div>
          <h2>BADGES</h2>
          <p className={styles.caption}>
            The number is the count needed for an achievement, or the top-N rank for a Hall of Fame
            badge.
          </p>
        </div>
        {draft.badges.map((badge, index) => (
          <div key={badge.key} className={styles.badgeRow}>
            <input
              className={styles.input}
              aria-label={`Name of badge ${label(badge.key)}`}
              maxLength={40}
              value={badge.name}
              onChange={(event) => edit('badges', index, { name: event.target.value })}
            />
            <input
              className={styles.input}
              aria-label={`Description of badge ${label(badge.key)}`}
              maxLength={120}
              value={badge.description}
              onChange={(event) => edit('badges', index, { description: event.target.value })}
            />
            {badge.threshold === null ? (
              <span className={styles.caption}>Monthly</span>
            ) : (
              <input
                className={styles.input}
                type="number"
                min={1}
                aria-label={`Threshold of badge ${label(badge.key)}`}
                value={badge.threshold}
                onChange={(event) =>
                  edit('badges', index, { threshold: number(event.target.value) })
                }
              />
            )}
            <label className={styles.check}>
              <Checkbox
                checked={badge.active}
                onChange={(event) => edit('badges', index, { active: event.target.checked })}
              />
              Active
            </label>
          </div>
        ))}
      </section>

      <section className={styles.card}>
        <div>
          <h2>REPUTATION POINTS</h2>
          <p className={styles.caption}>Changes apply to new events only.</p>
        </div>
        <div className={styles.points}>
          {POINTS.map(([key, name]) => (
            <label key={key} className={styles.stack}>
              <span className={styles.caption}>{name}</span>
              <input
                className={styles.input}
                type="number"
                value={draft.reputationPoints[key]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reputationPoints: {
                      ...current.reputationPoints,
                      [key]: number(event.target.value),
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <Message error={problem || action.error} success={done} />
      <div className={styles.saveBar}>
        <span className={styles.caption}>Last saved {date(saved.updatedAt)}</span>
        {dirty && (
          <button type="button" className={styles.linkButton} onClick={() => setDraft(saved)}>
            Discard changes
          </button>
        )}
        <PrimaryButton size="md" disabled={!dirty || action.busy} onClick={save}>
          {action.busy ? 'Saving…' : 'Save Changes'}
        </PrimaryButton>
      </div>
    </>
  );
}
