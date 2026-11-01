import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, ChoiceChip, GameCard, PrimaryButton, Tag } from '../../components/index.js';
import wheel from '../../assets/roulette/wheel.png';
import infoIcon from '../../assets/icons/info.svg';
import { api } from '../../lib/api.js';
import { cx } from '../../lib/cx.js';
import { toneForGenre } from '../../lib/tagTones.js';
import { FALLBACK_OPTIONS, optionLabel } from '../explore/exploreQuery.js';
import { cardTags, platformText } from '../games/gameLabels.js';
import featureStyles from '../shared/Features.module.css';
import { useResource } from '../shared/useResource.js';
import styles from './Roulette.module.css';

// Minutes the reviewer has (RouletteTime in docs/api enums.yaml).
const TIMES = [
  [15, 'Up to 15 min'],
  [30, 'Up to 30 min'],
  [60, 'Up to 1 hour'],
];
// The wheel turns at least this long, even when the API answers sooner.
const SPIN_MS = 1400;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Playtest Roulette. Figma: "Roulette preferences" (356:1636) and "Roulette result" (356:1690).
// POST /roulette/spin picks the game; the wheel only spins for show.
export function RoulettePage() {
  const navigate = useNavigate();
  const meta = useResource('/meta');
  const options = meta.data ?? (meta.error ? FALLBACK_OPTIONS : null);
  const [prefs, setPrefs] = useState({
    genres: [],
    platform: null,
    buildStage: null,
    maxMinutes: null,
  });
  const [result, setResult] = useState(null);
  const [seen, setSeen] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [turns, setTurns] = useState(0);
  const [error, setError] = useState(null);

  async function spin(exclude = seen) {
    setSpinning(true);
    setTurns((n) => n + 1);
    setError(null);
    try {
      const [spun] = await Promise.all([
        api.post('/roulette/spin', {
          ...(prefs.genres.length && { genres: prefs.genres }),
          ...(prefs.platform && { platform: prefs.platform }),
          ...(prefs.buildStage && { buildStage: prefs.buildStage }),
          ...(prefs.maxMinutes && { maxMinutes: prefs.maxMinutes }),
          ...(exclude.length && { exclude }),
        }),
        wait(SPIN_MS),
      ]);
      setResult(spun);
      setSeen([...exclude, spun.game.id]);
    } catch (err) {
      setError(err);
    } finally {
      setSpinning(false);
    }
  }

  async function start() {
    setSpinning(true);
    setError(null);
    try {
      await api.post('/roulette/accept', { spinToken: result.spinToken });
      navigate(`/games/${result.game.id}/review`);
    } catch (err) {
      setError(err);
      setSpinning(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h1 className={featureStyles.title}>PLAYTEST ROULETTE</h1>
      </div>
      {result ? (
        <Result
          result={result}
          busy={spinning}
          error={error}
          onStart={start}
          onSpinAgain={() => spin()}
          onChange={() => {
            setResult(null);
            setError(null);
          }}
        />
      ) : (
        <div className={styles.layout}>
          <div className={styles.wheelColumn}>
            <p className={styles.lead}>
              Pick what you’re in the mood for, then spin. We’ll choose a game for you to playtest.
            </p>
            <button
              type="button"
              className={styles.wheelButton}
              aria-label="Spin the wheel"
              disabled={spinning}
              onClick={() => spin()}
            >
              <img
                src={wheel}
                alt=""
                width={622}
                height={605}
                className={styles.wheel}
                style={{ '--turns': turns }}
              />
            </button>
          </div>
          <Preferences
            options={options}
            prefs={prefs}
            onChange={setPrefs}
            busy={spinning}
            error={error}
            onSpin={() => spin([])}
          />
        </div>
      )}
    </div>
  );
}

function ChipRow({ title, values, label, isSelected, onToggle }) {
  const id = useId();
  return (
    <div className={styles.row}>
      <h2 id={id} className={styles.rowTitle}>
        {title}
      </h2>
      <div className={styles.chips} role="group" aria-labelledby={id}>
        {values.map((value) => (
          <ChoiceChip key={value} selected={isSelected(value)} onClick={() => onToggle(value)}>
            {label(value)}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}

function Preferences({ options, prefs, onChange, busy, error, onSpin }) {
  const genreLabels = new Map((options?.genres ?? []).map((g) => [g.key, g.label]));
  // Platform, build stage and time take one value each (SpinInput); picking it again clears it.
  const single = (field) => (value) =>
    onChange({ ...prefs, [field]: prefs[field] === value ? null : value });
  return (
    <section className={styles.panel} aria-label="Preferences">
      {options ? (
        <>
          <ChipRow
            title="Genres"
            values={options.genres.map((g) => g.key)}
            label={(key) => genreLabels.get(key) ?? optionLabel(key)}
            isSelected={(key) => prefs.genres.includes(key)}
            onToggle={(key) =>
              onChange({
                ...prefs,
                genres: prefs.genres.includes(key)
                  ? prefs.genres.filter((g) => g !== key)
                  : [...prefs.genres, key],
              })
            }
          />
          <ChipRow
            title="Platform"
            values={options.platforms}
            label={optionLabel}
            isSelected={(value) => prefs.platform === value}
            onToggle={single('platform')}
          />
          <ChipRow
            title="Build stage"
            values={options.buildStages}
            label={optionLabel}
            isSelected={(value) => prefs.buildStage === value}
            onToggle={single('buildStage')}
          />
          <ChipRow
            title="Time you have"
            values={TIMES.map(([minutes]) => minutes)}
            label={(minutes) => TIMES.find(([m]) => m === minutes)[1]}
            isSelected={(minutes) => prefs.maxMinutes === minutes}
            onToggle={single('maxMinutes')}
          />
        </>
      ) : (
        <p className={styles.caption}>Loading options…</p>
      )}
      <p className={styles.info}>
        <img src={infoIcon} alt="" width={22} height={22} />
        No selection means all options are included.
      </p>
      <SpinError error={error} />
      <button type="button" className={styles.spin} disabled={busy || !options} onClick={onSpin}>
        {busy ? 'Spinning…' : 'Spin'}
      </button>
    </section>
  );
}

function SpinError({ error }) {
  if (!error) return null;
  if (error.status === 401) {
    return (
      <p role="alert" className={featureStyles.error}>
        <Link to="/login">Log in</Link> to spin the roulette.
      </p>
    );
  }
  return (
    <p role="alert" className={featureStyles.error}>
      {error.code === 'NO_MATCH'
        ? 'No game matches these preferences yet. Try fewer filters.'
        : error.message}
    </p>
  );
}

function Result({ result, busy, error, onStart, onSpinAgain, onChange }) {
  const { game } = result;
  const owner = game.owner?.displayName || game.owner?.username;
  return (
    <div className={styles.layout}>
      <GameCard
        className={styles.resultCard}
        title={game.title}
        description={game.pitch}
        coverSrc={game.coverUrl ?? undefined}
        coverAlt={`${game.title} cover`}
        tags={cardTags(game)}
      />
      <section className={cx(styles.panel, styles.resultPanel)} aria-labelledby="roulette-game">
        <h2 id="roulette-game" className={styles.gameTitle}>
          {game.title}
        </h2>
        <div className={styles.tags}>
          {game.genres.map((genre, i) => (
            <Tag key={genre} tone={i === 0 ? toneForGenre(genre) : 'neutral'}>
              {optionLabel(genre)}
            </Tag>
          ))}
        </div>
        {game.pitch && <p className={styles.pitch}>{game.pitch}</p>}
        <ul className={styles.details}>
          <li>
            Platform: {platformText(game.platforms)}
            {game.deliveryMethod === 'web' ? ', plays in your browser' : ', download required'}
          </li>
          {game.buildStage && <li>Build stage: {optionLabel(game.buildStage)}</li>}
          <li>
            Playtest: {game.missionCount} mission{game.missionCount === 1 ? '' : 's'}, about{' '}
            {game.estimatedMinutes} min
          </li>
          {owner && <li>Made by {owner}</li>}
        </ul>
        <SpinError error={error} />
        <div className={styles.actions}>
          <PrimaryButton size="md" className={styles.start} disabled={busy} onClick={onStart}>
            Start playtest
          </PrimaryButton>
          <Button variant="glass" className={styles.again} disabled={busy} onClick={onSpinAgain}>
            {busy ? 'Spinning…' : 'Spin again'}
          </Button>
        </div>
        <button type="button" className={styles.change} onClick={onChange}>
          Change preferences
        </button>
      </section>
    </div>
  );
}
