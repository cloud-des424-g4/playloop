import { Button, PrimaryButton, ReactionTag, Tag } from '../../components/index.js';
import { formatPlaytime } from '../../lib/format.js';
import { answerText } from '../reviews/answerText.js';
import featureStyles from '../shared/Features.module.css';
import { ErrorMessage, MarkedCard } from './ReviewUI.jsx';
import {
  AUDIENCES,
  COMPARISONS,
  DIFFICULTIES,
  ENJOYMENT,
  IMPROVE_CATEGORIES,
  STRENGTHS,
  answerFor,
  optionLabel,
  ownerName,
} from './reviewModel.js';
import styles from './Review.module.css';

// Short captions Figma uses for the default First Impression questions.
const PRESET_CAPTIONS = {
  difficulty: 'Expected difficulty',
  strength: 'Strongest part',
  audience: 'Made for',
  excitement: 'Excitement',
};
const TEXT_TYPES = ['short_answer', 'paragraph'];

// "review summary" (285:826): every answer, an Edit link per section and Submit Review.
export function ReviewSummary({ review, onEdit, onSubmit, busy, error }) {
  const { form, game, playtest } = review;
  const verdict = review.finalVerdict;
  const expected = review.expectations ?? {};
  const fiAnswers = form.firstImpression.questions
    .map((question) => ({
      question,
      answer: answerFor(review.firstImpression.answers, question.id),
    }))
    .filter(({ answer }) => answer);
  const missionNumber = (id) => form.playtest.missions.findIndex((m) => m.id === id) + 1;

  return (
    <div className={styles.screen}>
      <div className={styles.stage}>
        <Tag tone="lime" className={styles.gameTag}>
          {game.title}
        </Tag>
        <h1 className={featureStyles.title}>REVIEW SUMMARY</h1>
        <p className={styles.onSky}>
          Check your answers before you send them. {ownerName(review)} sees everything below.
        </p>
      </div>

      <SummarySection title="01 First Impression" onEdit={() => onEdit('first_impression')}>
        {fiAnswers
          .filter(({ question }) => TEXT_TYPES.includes(question.type))
          .map(({ question, answer }) => (
            <div key={question.id} className={styles.answer}>
              <p className={styles.caption}>{question.title}</p>
              <p className={styles.answerText}>{answer.text}</p>
            </div>
          ))}
        <dl className={styles.answerTags}>
          {fiAnswers
            .filter(({ question }) => !TEXT_TYPES.includes(question.type))
            .map(({ question, answer }) => (
              <div key={question.id}>
                <dt className={styles.caption}>
                  {PRESET_CAPTIONS[question.preset] ?? question.title}
                </dt>
                <dd>
                  <Tag>{answerText(answer, question)}</Tag>
                </dd>
              </div>
            ))}
        </dl>
      </SummarySection>

      <SummarySection title="02 Playtest" onEdit={() => onEdit('playtest')}>
        <p className={styles.caption}>
          Played for{' '}
          {playtest.playedSeconds < 60
            ? 'under a minute'
            : `${Math.round(playtest.playedSeconds / 60)} min`}{' '}
          · {review.deliveryMethod === 'web' ? 'web build' : 'downloaded build'}
        </p>
        <ol className={styles.summaryCards} aria-label="Reactions">
          {playtest.cards.map((card) => {
            const number = missionNumber(card.missionId);
            const mission = form.playtest.missions[number - 1];
            return (
              <li key={card.id} className={styles.summaryCard}>
                <div className={styles.summaryCardTop}>
                  <span>{mission ? `Mission ${number} · ${mission.title}` : 'Reaction'}</span>
                  <span className={styles.caption}>{formatPlaytime(card.playedSeconds)}</span>
                  <ReactionTag kind={card.type} />
                </div>
                <p>{card.comment}</p>
              </li>
            );
          })}
        </ol>
        {form.playtest.questions.map((question, i) => {
          const answer = answerFor(review.developerAnswers.answers, question.id);
          return (
            <div key={question.id} className={styles.answer}>
              <p className={styles.caption}>
                Developer’s question {i + 1}: {question.title}
              </p>
              <p className={styles.answerText}>
                {answer ? answerText(answer, question) : 'Not answered'}
              </p>
            </div>
          );
        })}
      </SummarySection>

      <SummarySection title="03 Final Verdict" onEdit={() => onEdit('final_verdict')}>
        <div className={styles.answer}>
          <p className={styles.caption}>Compared to your first impression, the game was:</p>
          <p className={styles.answerText}>{optionLabel(COMPARISONS, verdict.comparison)}</p>
        </div>
        <div className={styles.answer}>
          <p className={styles.caption}>How did your impression change after playing?</p>
          <p className={styles.answerText}>{verdict.changeText}</p>
        </div>
        <dl className={styles.compare}>
          {[
            ['Difficulty', DIFFICULTIES, expected.difficulty, verdict.actualDifficulty],
            ['Strongest part', STRENGTHS, expected.strength, verdict.actualStrength],
            ['Made for', AUDIENCES, expected.audience, verdict.actualAudience],
          ].map(([title, options, before, after]) => (
            <div key={title}>
              <dt className={styles.caption}>{title}</dt>
              <dd className={styles.tags}>
                <Tag>Expected: {optionLabel(options, before) || 'Not answered'}</Tag>
                <Tag tone="orange">Actual: {optionLabel(options, after) || 'Not answered'}</Tag>
              </dd>
            </div>
          ))}
        </dl>
        <div className={styles.answer}>
          <p className={styles.caption}>How much did you enjoy playing?</p>
          <Tag tone="blue" className={styles.gameTag}>
            {ENJOYMENT.valueLabels[verdict.enjoyment - 1] ?? 'Not answered'}
          </Tag>
        </div>
        <div className={styles.answer}>
          <p className={styles.caption}>What should the developer improve first?</p>
          <p className={styles.answerText}>
            {verdict.improveCategory === 'other'
              ? verdict.improveOther
              : optionLabel(IMPROVE_CATEGORIES, verdict.improveCategory)}
            . {verdict.improveText}
          </p>
        </div>
      </SummarySection>

      <ErrorMessage>{error}</ErrorMessage>
      <div className={styles.continue}>
        <p className={styles.ready}>Thank you for your time!</p>
        <PrimaryButton size="md" className={styles.next} disabled={busy} onClick={onSubmit}>
          {busy ? 'Submitting…' : 'Submit Review'}
        </PrimaryButton>
        <p className={styles.onSky}>You can still edit any section until you submit.</p>
      </div>
    </div>
  );
}

function SummarySection({ title, onEdit, children }) {
  return (
    <section className={styles.summarySection} aria-label={title}>
      <div className={styles.sectionHead}>
        <Tag tone="lilac">{title}</Tag>
        <Button variant="glass" onClick={onEdit} aria-label={`Edit ${title.slice(3)}`}>
          Edit
        </Button>
      </div>
      <MarkedCard className={styles.summaryBody}>{children}</MarkedCard>
    </section>
  );
}
