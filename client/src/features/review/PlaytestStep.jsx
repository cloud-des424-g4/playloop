import { useId, useRef, useState } from 'react';
import {
  Button,
  Keycap,
  MissionCard,
  PrimaryButton,
  ReactionEntry,
  Tag,
  TextField,
} from '../../components/index.js';
import { api } from '../../lib/api.js';
import { cx } from '../../lib/cx.js';
import { formatPlaytime } from '../../lib/format.js';
import { REACTIONS, toneForGenre } from '../../lib/tagTones.js';
import { optionLabel } from '../explore/exploreQuery.js';
import featureStyles from '../shared/Features.module.css';
import { ChoiceTags } from './QuestionInput.jsx';
import { ErrorMessage, MarkedCard } from './ReviewUI.jsx';
import styles from './Review.module.css';

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const PROOF_TYPES = ['image/png', 'image/jpeg'];
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

// Playtest page. Figma: "Review: Playtest (web)" (283:716) and, for download builds, the setup
// screen (283:928) followed by the playtest with an end-of-game screenshot (283:1025).
export function PlaytestStep({
  review,
  playing,
  onStartPlaying,
  onAccept,
  onAddCard,
  onUploadProof,
  onContinue,
  busy,
  error,
}) {
  const { game, form, playtest } = review;
  const download = review.deliveryMethod === 'download';
  if (download && !playing) return <DownloadSetup game={game} onReady={onStartPlaying} />;

  const missions = form.playtest.missions;
  const accepted = playtest.acceptedMissionIds;
  const missing = missions.filter((m) => !accepted.includes(m.id)).length;
  const needsProof = download && !playtest.proofScreenshotUrl;
  const questions = form.playtest.questions.length;
  const nextText = missing
    ? 'Accept every mission to continue.'
    : needsProof
      ? 'Add your end-of-game screenshot to continue.'
      : questions
        ? `Next: ${NUMBER_WORDS[questions] ?? questions} question${questions === 1 ? '' : 's'} from the developer`
        : 'Next: your final verdict';
  const latest = missions.find((m) => m.id === accepted.at(-1));

  const missionList = (
    <ol className={cx(styles.missions, download && styles.missionsColumn)} aria-label="Missions">
      {missions.map((mission, i) => (
        <li key={mission.id}>
          <MissionCard
            title={`Mission ${i + 1}`}
            duration={`~${mission.minutes} min`}
            description={mission.title}
            state={accepted.includes(mission.id) ? 'accepted' : 'available'}
            onAccept={busy ? undefined : () => onAccept(mission.id)}
          />
        </li>
      ))}
    </ol>
  );
  const reactions = (
    <Reactions
      cards={playtest.cards}
      missionLabel={latest && `Mission ${missions.indexOf(latest) + 1}`}
      onSend={onAddCard}
    />
  );
  const controls = <Controls controls={game.controls} />;
  const issues = <KnownIssues issues={form.playtest.knownIssues} />;

  return (
    <div className={styles.screen}>
      <GameHeader game={game} />
      <p className={styles.instruction}>Complete all missions and react while playing the game!</p>
      {download ? (
        <div className={styles.downloadArea}>
          <div className={styles.column}>
            <MarkedCard as="section" aria-label="Missions" className={styles.missionPanel}>
              <h2 className={styles.panelTitle}>Missions</h2>
              {missionList}
            </MarkedCard>
            {issues}
          </div>
          <div className={styles.column}>
            {reactions}
            {controls}
          </div>
        </div>
      ) : (
        <>
          {missionList}
          <div className={styles.playArea}>
            <div className={styles.column}>
              {game.webPlayUrl ? (
                <iframe
                  className={styles.game}
                  src={game.webPlayUrl}
                  title={`${game.title} game`}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
                  allow="fullscreen; autoplay; gamepad"
                />
              ) : (
                <div className={cx(styles.game, styles.noGame)}>
                  This game can’t be played in the browser right now.
                </div>
              )}
              {controls}
            </div>
            <div className={cx(styles.column, styles.side)}>
              {reactions}
              {issues}
            </div>
          </div>
        </>
      )}
      {download && (
        <ProofUpload url={playtest.proofScreenshotUrl} onUpload={onUploadProof} busy={busy} />
      )}
      <ErrorMessage>{error}</ErrorMessage>
      <div className={styles.continue}>
        <PrimaryButton
          size="md"
          className={styles.next}
          disabled={busy || missing > 0 || needsProof}
          onClick={onContinue}
        >
          {busy ? 'Saving…' : 'Continue'}
        </PrimaryButton>
        <p className={styles.onSky}>{nextText}</p>
      </div>
    </div>
  );
}

function GameHeader({ game }) {
  return (
    <div className={styles.gameHeader}>
      <div className={styles.stage}>
        <h1 className={cx(featureStyles.title, styles.upper)}>{game.title}</h1>
        <div className={styles.tags}>
          {game.genres.map((genre) => (
            <Tag key={genre} tone={toneForGenre(genre)}>
              {optionLabel(genre)}
            </Tag>
          ))}
        </div>
      </div>
      {game.pitch && <p className={styles.pitch}>{game.pitch}</p>}
    </div>
  );
}

function Controls({ controls }) {
  if (!controls.length) return null;
  return (
    <section className={cx(styles.card, styles.controls)} aria-label="Controls">
      <h2 className={styles.controlsTitle}>Controls</h2>
      <dl className={styles.controlList}>
        {controls.map((control) => (
          <div key={`${control.key}-${control.action}`} className={styles.control}>
            <dt>
              <Keycap>{control.key}</Keycap>
            </dt>
            <dd>{control.action}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function KnownIssues({ issues }) {
  if (!issues.length) return null;
  return (
    <section className={cx(styles.card, styles.panel, styles.issues)} aria-label="Known issues">
      <h2 className={styles.issuesTitle}>Known issues</h2>
      <ul className={styles.issueList}>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      <p className={styles.caption}>No need to report these.</p>
    </section>
  );
}

// Reactions panel (283:886): the cards so far and a composer. A card belongs to the mission
// accepted most recently, so reacting needs at least one accepted mission.
function Reactions({ cards, missionLabel, onSend }) {
  const id = useId();
  const [type, setType] = useState(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSending(true);
    const sent = await onSend({ type, comment: comment.trim() });
    setSending(false);
    if (sent) {
      setComment('');
      setType(null);
    }
  }
  return (
    <section className={cx(styles.card, styles.panel)} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.panelTitle}>
        Reactions
      </h2>
      <p className={styles.caption}>
        React any time while you play. Your playtime is added for you.
      </p>
      {cards.length > 0 && (
        <ol className={styles.reactionList} aria-label="Your reactions">
          {cards.map((card) => (
            <li key={card.id}>
              <ReactionEntry
                kind={card.type}
                timestamp={formatPlaytime(card.playedSeconds)}
                comment={card.comment}
              />
            </li>
          ))}
        </ol>
      )}
      <form className={styles.composer} onSubmit={submit}>
        <p id={`${id}-new`} className={styles.caption}>
          New reaction{missionLabel && ` · ${missionLabel}`}
        </p>
        <fieldset disabled={!missionLabel || sending} className={styles.fieldset}>
          <ChoiceTags
            name={`${id}-type`}
            labelledBy={`${id}-new`}
            options={['confused', 'enjoyed', 'bug'].map((kind) => [kind, REACTIONS[kind].label])}
            selected={type}
            onSelect={setType}
            toneFor={(kind) => REACTIONS[kind].tone}
          />
          <div className={styles.commentRow}>
            <TextField
              label="Comment"
              className={styles.hiddenLabel}
              placeholder="Add a comment"
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <PrimaryButton
              size="md"
              type="submit"
              className={styles.send}
              disabled={!type || !comment.trim()}
            >
              Send
            </PrimaryButton>
          </div>
        </fieldset>
        {!missionLabel && <p className={styles.caption}>Accept a mission to start reacting.</p>}
      </form>
    </section>
  );
}

// End-of-game screenshot for download builds (283:1025, "Finished the game?").
function ProofUpload({ url, onUpload, busy }) {
  const input = useRef(null);
  const [problem, setProblem] = useState('');
  const [dragging, setDragging] = useState(false);
  function take(file) {
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type)) return setProblem('Use a PNG or JPG screenshot.');
    if (file.size > PROOF_MAX_BYTES) return setProblem('That screenshot is over 5 MB.');
    setProblem('');
    onUpload(file);
  }
  return (
    <section className={cx(styles.card, styles.proof)} aria-label="End-of-game screenshot">
      <div className={styles.proofHead}>
        <h2 className={styles.proofTitle}>
          Finished the game? Take a screenshot at the end of the game.
        </h2>
        <p className={styles.proofHint}>It shows the developer how far you got.</p>
      </div>
      <div
        className={cx(styles.dropzone, dragging && styles.dragging)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files[0]);
        }}
      >
        {url ? (
          <img src={url} alt="Your end-of-game screenshot" className={styles.proofImage} />
        ) : (
          <p className={styles.dropText}>Drag your screenshot here</p>
        )}
        <Button variant="glass" disabled={busy} onClick={() => input.current.click()}>
          {url ? 'Replace screenshot' : 'Browse files'}
        </Button>
        <p className={styles.caption}>PNG or JPG, max 5 MB</p>
        <input
          ref={input}
          type="file"
          accept={PROOF_TYPES.join(',')}
          className="visually-hidden"
          tabIndex={-1}
          aria-label="Screenshot file"
          onChange={(e) => {
            take(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
      <ErrorMessage>{problem}</ErrorMessage>
    </section>
  );
}

const TARGETS = [
  ['windows', 'Windows'],
  ['mac', 'Mac'],
  ['linux', 'Linux'],
];

function formatSize(bytes) {
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

// "Download the demo" (283:928). Links are short-lived, so each is fetched when clicked.
function DownloadSetup({ game, onReady }) {
  const [error, setError] = useState('');
  async function download(option) {
    setError('');
    try {
      const link = await api.get(`/games/${game.id}/builds/${option.buildId}/download`);
      window.location.assign(link.url);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className={styles.screen}>
      <GameHeader game={game} />
      <section className={cx(styles.card, styles.downloadCard)} aria-label="Download the demo">
        <h2 className={styles.panelTitle}>Download the demo</h2>
        <p className={styles.body}>
          This game runs on your computer. Download the build for your system, unzip it and open{' '}
          {game.title}. Come back here once the game is running.
        </p>
        <ul className={styles.downloads}>
          {TARGETS.map(([target, name]) => {
            const option = game.downloads.find((d) => d.target === target);
            return (
              <li key={target} className={cx(styles.download, !option && styles.unavailable)}>
                <span className={styles.os}>{name}</span>
                {option ? (
                  <>
                    <span className={styles.file}>
                      <span>{option.fileName}</span>
                      <span className={styles.caption}>
                        {formatSize(option.size)} · Version {option.version}
                      </span>
                    </span>
                    <Button variant="glass" onClick={() => download(option)}>
                      Download
                    </Button>
                  </>
                ) : (
                  <span className={styles.caption}>Not available for this game</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <ErrorMessage>{error}</ErrorMessage>
      <div className={styles.continue}>
        <p className={styles.ready}>Ready to play the game?</p>
        <PrimaryButton size="md" className={styles.next} onClick={onReady}>
          Finish Setup
        </PrimaryButton>
      </div>
    </div>
  );
}
