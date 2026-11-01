import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router';
import {
  Button,
  CheckboxField,
  PrimaryButton,
  Select,
  Tag,
  TextField,
  Textarea,
} from '../../components/index.js';
import editIcon from '../../assets/icons/edit.svg';
import { api } from '../../lib/api.js';
import { cx } from '../../lib/cx.js';
import { toneForGenre } from '../../lib/tagTones.js';
import { uploadFile } from '../../lib/upload.js';
import { FALLBACK_OPTIONS, optionLabel } from '../explore/exploreQuery.js';
import { ChoiceTags } from '../review/QuestionInput.jsx';
import { RequestState } from '../shared/FeatureUI.jsx';
import featureStyles from '../shared/Features.module.css';
import { useResource } from '../shared/useResource.js';
import {
  BulletList,
  ControlsEditor,
  CreditsEditor,
  GameFileSection,
  MediaEditor,
  PageOptions,
  TagListEditor,
} from './EditorSections.jsx';
import {
  ENGINES,
  LIMITS,
  fromGame,
  problemSummary,
  publishProblems,
  savedText,
  toPayload,
} from './editorModel.js';
import { updatedDate } from './gameLabels.js';
import styles from './GameEditor.module.css';

const AUTOSAVE_MS = 2000;

const errorText = (err) =>
  err.details?.length
    ? `${err.message}: ${err.details.map((d) => d.message).join(', ')}.`
    : err.message;

// Game editor for /my-games/new and /my-games/:gameId/edit. Figma: "published game" (257:515),
// which is the editor ("Editing · Draft"). It mirrors the public game page with every part editable.
export function GameEditorPage() {
  const { gameId } = useParams();
  const resource = useResource(gameId ? `/games/${gameId}` : null);
  const meta = useResource('/meta');
  const options = meta.data ?? (meta.error ? FALLBACK_OPTIONS : null);
  if (!gameId) return <NewGame />;
  return (
    <RequestState resource={resource}>
      {resource.data &&
        (resource.data.isOwner ? (
          <GameEditor key={gameId} initial={resource.data} options={options} />
        ) : (
          <p role="alert" className={featureStyles.error}>
            Only the developer of this game can edit it.
          </p>
        ))}
    </RequestState>
  );
}

// A game needs a title before it exists (POST /games), and uploads need the game, so a new game
// starts with just its name.
function NewGame() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function create(event) {
    event.preventDefault();
    if (!title.trim()) return setError('Give your game a name.');
    setBusy(true);
    try {
      const game = await api.post('/games', { title: title.trim() });
      navigate(`/my-games/${game.id}/edit`, { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Log in to publish a game.' : errorText(err));
      setBusy(false);
    }
  }
  return (
    <form className={styles.page} onSubmit={create}>
      <div className={styles.status}>
        <Tag tone="orange">New game</Tag>
      </div>
      <TitleField value={title} onChange={setTitle} autoFocus />
      <p className={styles.onSky}>Name your game to start a draft. You can change it later.</p>
      {error && (
        <p role="alert" className={featureStyles.error}>
          {error}
        </p>
      )}
      <PrimaryButton size="md" type="submit" className={styles.startButton} disabled={busy}>
        {busy ? 'Creating…' : 'Create draft'}
      </PrimaryButton>
    </form>
  );
}

function TitleField({ value, onChange, autoFocus }) {
  return (
    <label className={styles.titleBox}>
      <span className="visually-hidden">Game title</span>
      <input
        className={styles.titleInput}
        maxLength={LIMITS.title}
        placeholder="Your game"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <img src={editIcon} alt="" width={40} height={40} />
    </label>
  );
}

function GameEditor({ initial, options }) {
  const navigate = useNavigate();
  const [game, setGame] = useState(initial);
  const [form, setForm] = useState(() => fromGame(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(toPayload(fromGame(initial))));
  const [savedAt, setSavedAt] = useState(() => Date.parse(initial.updatedAt));
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const payload = useMemo(() => toPayload(form), [form]);
  const payloadText = JSON.stringify(payload);
  const dirty = payloadText !== saved;
  const draft = game.status === 'draft';
  const problems = publishProblems(form, game);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  async function save() {
    if (!form.title.trim()) {
      setError('Give your game a title.');
      return false;
    }
    setSaving(true);
    setError('');
    try {
      setGame(await api.patch(`/games/${game.id}`, payload));
      setSaved(payloadText);
      setSavedAt(Date.now());
      setNow(Date.now());
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Drafts save themselves a moment after each change; a published game must stay complete, so it
  // only saves on Save changes.
  const autosave = useRef(save);
  useEffect(() => {
    autosave.current = save;
  });
  useEffect(() => {
    if (!draft || !dirty || saving) return;
    const timer = setTimeout(() => autosave.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [payloadText, draft, dirty, saving]);

  const blocker = useBlocker(dirty && !draft);
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  async function withBusy(task) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  const patchMedia = (ids) =>
    api
      .patch(`/games/${game.id}`, { mediaIds: ids })
      .then((next) => setGame((current) => ({ ...current, media: next.media })));
  const mediaIds = game.media.map((m) => m.id);

  async function publish() {
    if (dirty && !(await save())) return;
    await withBusy(async () => {
      await api.post(`/games/${game.id}/publish`);
      navigate(`/games/${game.id}`);
    });
  }
  async function preview() {
    if (dirty && !(await save())) return;
    navigate(`/games/${game.id}`);
  }

  return (
    <div className={styles.page}>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-label="Unsaved changes" className={featureStyles.question}>
          <p>You have unsaved changes. Leave without saving?</p>
          <div className={featureStyles.row}>
            <Button onClick={() => blocker.reset()}>Keep editing</Button>
            <Button variant="glass" onClick={() => blocker.proceed()}>
              Discard and leave
            </Button>
          </div>
        </div>
      )}
      <div className={styles.status}>
        <Tag tone="orange">{draft ? 'Editing · Draft' : 'Editing · Published'}</Tag>
        <span className={styles.onSky}>{saving ? 'Saving…' : savedText(savedAt, now)}</span>
      </div>

      <section className={styles.hero} aria-label="Title, tags and platforms">
        <div className={styles.titleBlock}>
          <TitleField value={form.title} onChange={(title) => update({ title })} />
          <GenreEditor
            genres={form.genres}
            options={options}
            onChange={(genres) => update({ genres })}
          />
        </div>
        <fieldset className={styles.platformCard}>
          <legend className={styles.caption}>Platform *</legend>
          {(options?.platforms ?? []).map((platform) => (
            <CheckboxField
              key={platform}
              label={optionLabel(platform)}
              checked={form.platforms.includes(platform)}
              onChange={() =>
                update({
                  platforms: form.platforms.includes(platform)
                    ? form.platforms.filter((p) => p !== platform)
                    : [...form.platforms, platform],
                })
              }
            />
          ))}
        </fieldset>
      </section>

      <MediaEditor
        media={game.media}
        busy={busy}
        onAdd={(files) =>
          withBusy(async () => {
            const ids = [];
            for (const file of files) {
              ids.push((await uploadFile({ purpose: 'game_media', file, gameId: game.id })).id);
            }
            await patchMedia([...mediaIds, ...ids]);
          })
        }
        onRemove={(id) => withBusy(() => patchMedia(mediaIds.filter((m) => m !== id)))}
        onCover={(id) => withBusy(() => patchMedia([id, ...mediaIds.filter((m) => m !== id)]))}
      />

      <section className={styles.pitchPanel} aria-label="One-line pitch">
        <div className={styles.pitchRow}>
          <TextField
            label="One-line pitch *"
            maxLength={LIMITS.pitch}
            value={form.pitch}
            onChange={(e) => update({ pitch: e.target.value })}
          />
          <span className={styles.counter}>
            {form.pitch.length} / {LIMITS.pitch}
          </span>
        </div>
        <p className={styles.caption}>Shown under your title and on game cards.</p>
      </section>

      <div className={styles.details}>
        <div className={styles.info}>
          <section className={styles.panel} aria-labelledby="edit-warnings">
            <h2 id="edit-warnings" className={styles.fieldTitle}>
              Content warnings
            </h2>
            <TagListEditor
              label="Content warning"
              tone="pink"
              items={form.contentWarnings}
              max={LIMITS.warnings}
              maxLength={LIMITS.warning}
              onChange={(contentWarnings) => update({ contentWarnings })}
            />
            <p className={styles.caption}>Optional. Shown before players start.</p>
          </section>
          <section className={styles.panel} aria-labelledby="edit-stage">
            <h2 id="edit-stage" className={styles.fieldTitle}>
              Build stage *
            </h2>
            <ChoiceTags
              name="build-stage"
              labelledBy="edit-stage"
              options={(options?.buildStages ?? []).map((stage) => [stage, optionLabel(stage)])}
              selected={form.buildStage}
              onSelect={(buildStage) => update({ buildStage })}
            />
          </section>
          <section className={styles.panel} aria-label="Version">
            <TextField
              label="Version *"
              placeholder="0.1"
              maxLength={20}
              hint={
                game.lastUpdatedAt
                  ? `Last updated: ${updatedDate(game.lastUpdatedAt)}`
                  : 'Last updated: set when you publish'
              }
              value={form.version}
              onChange={(e) => update({ version: e.target.value })}
            />
          </section>
          <section className={styles.controlsCard} aria-labelledby="edit-controls">
            <h2 id="edit-controls" className={styles.cardTitle}>
              Controls
            </h2>
            <ControlsEditor
              controls={form.controls}
              onChange={(controls) => update({ controls })}
            />
          </section>
        </div>

        <div className={styles.content}>
          <section className={cx(styles.card, styles.marked)} aria-labelledby="edit-core">
            <h2 id="edit-core" className={styles.cardTitle}>
              Core Gameplay *
            </h2>
            <p className={styles.caption}>2–4 bullets</p>
            <BulletList
              label="Core gameplay"
              items={form.coreGameplay}
              min={2}
              max={LIMITS.core}
              onChange={(coreGameplay) => update({ coreGameplay })}
            />
          </section>
          <section className={cx(styles.card, styles.marked)} aria-labelledby="edit-notes">
            <h2 id="edit-notes" className={styles.notesTitle}>
              Dev Notes
            </h2>
            <p className={styles.caption}>Optional</p>
            <Textarea
              label="Dev notes"
              className={styles.hiddenLabel}
              rows={6}
              maxLength={LIMITS.devNotes}
              value={form.devNotes}
              onChange={(e) => update({ devNotes: e.target.value })}
            />
          </section>
          <section className={cx(styles.card, styles.playable)} aria-labelledby="edit-playable">
            <h2 id="edit-playable" className={styles.cardTitle}>
              What’s playable *
            </h2>
            <BulletList
              label="What’s playable"
              items={form.playable}
              min={1}
              max={LIMITS.playable}
              onChange={(playable) => update({ playable })}
            />
          </section>
          <section
            className={cx(styles.card, styles.marked, styles.builtWith)}
            aria-labelledby="edit-engine"
          >
            <h2 id="edit-engine" className={styles.cardTitle}>
              Built with *
            </h2>
            <ChoiceTags
              name="engine"
              labelledBy="edit-engine"
              options={ENGINES}
              selected={form.engine}
              onSelect={(engine) => update({ engine })}
            />
            {form.engine === 'other' && (
              <TextField
                label="Engine name"
                maxLength={30}
                value={form.engineOther}
                onChange={(e) => update({ engineOther: e.target.value })}
              />
            )}
          </section>
        </div>
      </div>

      <CreditsEditor credits={form.credits} onChange={(credits) => update({ credits })} />

      <div className={styles.ctaPreview}>
        <PrimaryButton aria-disabled="true" tabIndex={-1} className={styles.ctaButton}>
          Try our Game!
        </PrimaryButton>
        <p className={styles.onSky}>
          Preview. Reviewers press this to start, so set up your game file below.
        </p>
      </div>

      <PageOptions
        theme={form.theme}
        imageUrl={game.theme.backgroundImageUrl}
        busy={busy}
        onChange={(theme) => update({ theme })}
        onUploadBackground={(file) =>
          withBusy(async () => {
            const upload = await uploadFile({ purpose: 'game_background', file, gameId: game.id });
            const next = await api.patch(`/games/${game.id}`, {
              theme: { backgroundUploadId: upload.id },
            });
            setGame((current) => ({ ...current, theme: next.theme }));
            update({ theme: { ...form.theme, backgroundPreset: null } });
          })
        }
      />

      <div className={styles.setupBand}>
        <h2 className={styles.setupTitle}>Below this line: playtest setup</h2>
        <p className={styles.setupText}>
          Reviewers use this during the playtest. It isn’t shown on your public game page.{' '}
          <Link to={`/my-games/${game.id}/form`}>
            Missions and questions are in your PlayLoop form.
          </Link>
        </p>
      </div>

      <GameFileSection
        delivery={form.delivery}
        builds={game.delivery.builds}
        busy={busy}
        onChange={(delivery) => update({ delivery })}
        onUploadBuild={(target, file) =>
          withBusy(async () => {
            const upload = await uploadFile({
              purpose: target === 'web' ? 'web_build' : 'download_build',
              file,
              gameId: game.id,
            });
            const build = await api.post(`/games/${game.id}/builds`, {
              uploadId: upload.id,
              target,
            });
            setGame((current) => ({
              ...current,
              delivery: {
                ...current.delivery,
                builds: [...current.delivery.builds.filter((b) => b.target !== target), build],
              },
            }));
          })
        }
      />

      {error && (
        <p role="alert" className={featureStyles.error}>
          {error}
        </p>
      )}

      <div className={styles.publishBar}>
        <div className={styles.publishStatus}>
          <p className={styles.publishState}>
            {draft ? 'Draft' : 'Published'} ·{' '}
            {saving ? 'saving…' : savedText(savedAt, now).toLowerCase()}
          </p>
          {problems.length > 0 && <p className={styles.problems}>{problemSummary(problems)}</p>}
        </div>
        {draft ? (
          <>
            <Button variant="glass" disabled={saving || !dirty} onClick={save}>
              Save draft
            </Button>
            <Button variant="glass" disabled={saving} onClick={preview}>
              Preview
            </Button>
            <PrimaryButton
              size="md"
              className={styles.next}
              disabled={busy || saving || problems.length > 0}
              onClick={publish}
            >
              Publish Game
            </PrimaryButton>
          </>
        ) : (
          <>
            <Button variant="glass" as={Link} to={`/games/${game.id}`}>
              View page
            </Button>
            <PrimaryButton
              size="md"
              className={styles.next}
              disabled={saving || !dirty}
              onClick={save}
            >
              Save changes
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}

function GenreEditor({ genres, options, onChange }) {
  const labels = new Map((options?.genres ?? []).map((g) => [g.key, g.label]));
  const available = (options?.genres ?? []).filter((g) => !genres.includes(g.key));
  return (
    <div className={styles.genres}>
      {genres.map((genre) => (
        <button
          key={genre}
          type="button"
          className={styles.removableTag}
          aria-label={`Remove ${labels.get(genre) ?? optionLabel(genre)}`}
          onClick={() => onChange(genres.filter((g) => g !== genre))}
        >
          <Tag tone={toneForGenre(genre)}>{labels.get(genre) ?? optionLabel(genre)} ×</Tag>
        </button>
      ))}
      {genres.length < LIMITS.genres && available.length > 0 && (
        <Select
          aria-label="Add a genre tag"
          className={styles.addTag}
          placeholder="+ Add tag"
          value=""
          options={available.map((g) => ({ value: g.key, label: g.label }))}
          onChange={(e) => e.target.value && onChange([...genres, e.target.value])}
        />
      )}
    </div>
  );
}
