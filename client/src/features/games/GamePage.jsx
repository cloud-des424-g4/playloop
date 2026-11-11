import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Keycap, PrimaryButton, Tag } from '../../components/index.js';
import { usePageLook } from '../../components/layout/pageLook.js';
import { cx } from '../../lib/cx.js';
import { toneForGenre } from '../../lib/tagTones.js';
import { optionLabel } from '../explore/exploreQuery.js';
import { RequestState } from '../shared/FeatureUI.jsx';
import { useResource } from '../shared/useResource.js';
import { engineLabel, platformText, updatedDate } from './gameLabels.js';
import { themeLook } from './gameTheme.js';
import styles from './GamePage.module.css';

// Public game page. Figma: "game description" (167:980), shown in the Storm theme there; every
// game uses its own theme from the editor's Page options.
export function GamePage() {
  const { gameId } = useParams();
  const resource = useResource(`/games/${gameId}`);
  const theme = resource.data?.theme;
  const look = useMemo(() => theme && themeLook(theme), [theme]);
  usePageLook(look);
  return (
    <RequestState resource={resource}>
      {resource.data && <GameView key={resource.data.id} game={resource.data} />}
    </RequestState>
  );
}

export function GameView({ game, preview = false }) {
  const [selected, setSelected] = useState(0);
  const media = game.media[selected] ?? game.media[0];
  return (
    <article className={styles.page}>
      {game.status === 'draft' && !preview && (
        <Tag tone="sunny" className={styles.draft}>
          Draft preview · only you can see this page
        </Tag>
      )}
      <header className={cx(styles.hero, styles.marked, styles.markedTight)}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{game.title}</h1>
          <div className={styles.tags}>
            {game.genres.map((genre) => (
              <Tag key={genre} tone={toneForGenre(genre)}>
                {optionLabel(genre)}
              </Tag>
            ))}
          </div>
        </div>
        {game.platforms.length > 0 && (
          <p className={styles.platform}>Platform: {platformText(game.platforms)}</p>
        )}
      </header>

      {game.media.length > 0 && (
        <section className={styles.media} aria-label="Screenshots and videos">
          <div className={styles.mainMedia}>
            {media.type === 'video' ? (
              <video src={media.url} controls className={styles.mediaFill} />
            ) : (
              <img
                src={media.url}
                alt={`${game.title} screenshot ${selected + 1}`}
                className={styles.mediaFill}
              />
            )}
          </div>
          {game.media.length > 1 && (
            <ul className={styles.thumbs}>
              {game.media.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cx(styles.thumb, i === selected && styles.selected)}
                    aria-pressed={i === selected}
                    aria-label={`Show ${item.type === 'video' ? 'video' : 'screenshot'} ${i + 1}`}
                    onClick={() => setSelected(i)}
                  >
                    {item.type === 'video' ? (
                      <video src={item.url} muted preload="metadata" />
                    ) : (
                      <img src={item.url} alt="" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {game.pitch && <p className={styles.pitch}>{game.pitch}</p>}

      <div className={styles.details}>
        <div className={styles.info}>
          {game.contentWarnings.length > 0 && (
            <section className={styles.box} aria-label="Content warnings">
              <p className={styles.boxCaption}>-- Content Warnings --</p>
              <ul className={styles.plainList}>
                {game.contentWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}
          {game.buildStage && (
            <p className={styles.box} aria-label="Build stage">
              {optionLabel(game.buildStage)}
            </p>
          )}
          {game.version && (
            <p className={styles.box}>
              Version {game.version}
              <span className={styles.boxCaption}>
                last updated: {updatedDate(game.lastUpdatedAt) || 'not yet published'}
              </span>
            </p>
          )}
          {game.controls.length > 0 && (
            <section className={styles.controls} aria-labelledby="game-controls">
              <h2 id="game-controls" className={styles.cardTitle}>
                Controls
              </h2>
              <dl className={styles.controlList}>
                {game.controls.map((control) => (
                  <div key={`${control.key}-${control.action}`}>
                    <dt>
                      <Keycap>{control.key}</Keycap>
                    </dt>
                    <dd>{control.action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <div className={styles.content}>
          {game.coreGameplay.length > 0 && (
            <BulletCard title="Core Gameplay" items={game.coreGameplay} className={styles.marked} />
          )}
          {game.devNotes && (
            <section className={cx(styles.card, styles.marked)} aria-labelledby="game-dev-notes">
              <h2 id="game-dev-notes" className={styles.notesTitle}>
                Dev Notes
              </h2>
              <p className={styles.body}>{game.devNotes}</p>
            </section>
          )}
          {game.playable.length > 0 && (
            <BulletCard title="What’s playable" items={game.playable} className={styles.playable} />
          )}
          {game.engine && (
            <section
              className={cx(styles.card, styles.marked, styles.builtWith)}
              aria-labelledby="game-engine"
            >
              <h2 id="game-engine" className={styles.cardTitle}>
                Built with
              </h2>
              <p className={styles.engine}>{engineLabel(game)}</p>
            </section>
          )}
        </div>
      </div>

      {game.credits.length > 0 && (
        <dl className={styles.credits} aria-label="Credits">
          {game.credits.map((credit, i) => (
            <div key={`${credit.role}-${i}`}>
              <dt>{credit.role}</dt>
              <dd>{credit.name}</dd>
            </div>
          ))}
        </dl>
      )}

      {!preview && <CallToAction game={game} />}
    </article>
  );
}

function BulletCard({ title, items, className }) {
  const id = `game-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className={cx(styles.card, className)} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      <ul className={styles.bullets}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

// "Try our Game!" starts (or resumes) the review flow. The owner can't review their own game, so
// they get Edit game instead. The link to the reviews is not in Figma.
function CallToAction({ game }) {
  let action;
  if (game.isOwner) {
    action = (
      <PrimaryButton as={Link} to={`/my-games/${game.id}/edit`} className={styles.ctaButton}>
        Edit game
      </PrimaryButton>
    );
  } else if (game.myReview?.status === 'submitted') {
    action = (
      <PrimaryButton as={Link} to={`/reviews/${game.myReview.id}`} className={styles.ctaButton}>
        Read your review
      </PrimaryButton>
    );
  } else if (game.status === 'published') {
    action = (
      <PrimaryButton as={Link} to={`/games/${game.id}/review`} className={styles.ctaButton}>
        {game.myReview ? 'Continue your review' : 'Try our Game!'}
      </PrimaryButton>
    );
  }
  return (
    <div className={styles.cta}>
      {action}
      {game.status === 'published' && (
        <Link to={`/games/${game.id}/reviews`} className={styles.reviewsLink}>
          Reviews &amp; Discussion ({game.reviewCount})
        </Link>
      )}
    </div>
  );
}
