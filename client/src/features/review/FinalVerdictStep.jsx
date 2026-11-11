import { useId } from 'react';
import {
  Avatar,
  PrimaryButton,
  ReviewProgress,
  TextField,
  Textarea,
} from '../../components/index.js';
import { cx } from '../../lib/cx.js';
import featureStyles from '../shared/Features.module.css';
import { ChoiceTags, Slider } from './QuestionInput.jsx';
import { ErrorMessage, MarkedCard, StageHeading, StepNav } from './ReviewUI.jsx';
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

const TITLES = {
  1: 'YOUR FIRST IMPRESSION',
  2: 'EXPECTED VS. ACTUAL',
  3: 'ENJOYMENT',
  4: 'IMPROVEMENT',
};

// Final Verdict. Figma: the developer's farewell (284:868), the intro (284:896) and four steps
// (284:922, 284:1008, 284:1141, 284:1217). None of these screens has a Leave button.
export function FinalVerdictStep({ review, step, verdict, onChange, onBack, onNext, busy, error }) {
  if (step === 'farewell') {
    return (
      <div className={styles.centered}>
        <Avatar src={review.game.owner?.avatarUrl} name={ownerName(review)} size={120} />
        <p className={styles.onSky}>
          A message from {ownerName(review)}, who made {review.game.title}
        </p>
        <blockquote className={styles.farewell}>
          {review.form.finalVerdict.farewellMessage}
        </blockquote>
        <PrimaryButton size="md" className={styles.next} onClick={onNext}>
          Continue
        </PrimaryButton>
      </div>
    );
  }
  if (step === 'intro') {
    return (
      <div className={styles.centered}>
        <h1 className={cx(featureStyles.title, styles.introTitle)}>
          BEFORE YOU TAKE OFF, WE’D LOVE TO HEAR YOUR THOUGHTS!
        </h1>
        <p className={styles.onSky}>
          Four short questions about how the game compared with your first impression.
        </p>
        <PrimaryButton size="md" className={styles.next} onClick={onNext}>
          Start
        </PrimaryButton>
      </div>
    );
  }
  return (
    <div className={styles.screen}>
      <StageHeading title={TITLES[step]}>
        <ReviewProgress currentStep={step} totalSteps={4} />
      </StageHeading>
      <MarkedCard className={styles.verdictCard}>
        <VerdictFields review={review} step={step} verdict={verdict} onChange={onChange} />
      </MarkedCard>
      <ErrorMessage>{error}</ErrorMessage>
      <StepNav onBack={step > 1 ? onBack : undefined} onNext={onNext} busy={busy} />
    </div>
  );
}

function VerdictQuestion({ id, title, hint, children }) {
  return (
    <div className={styles.verdictQuestion}>
      <h2 id={id} className={styles.bulletTitle}>
        {title}
      </h2>
      {hint && <p className={styles.caption}>{hint}</p>}
      {children}
    </div>
  );
}

function VerdictFields({ review, step, verdict, onChange }) {
  const id = useId();
  const expected = review.expectations ?? {};
  const set = (field) => (value) => onChange({ ...verdict, [field]: value });

  if (step === 1) {
    return (
      <>
        {expected.impressionText && (
          <figure className={styles.quote}>
            <figcaption className={styles.caption}>What you wrote before playing</figcaption>
            <blockquote>“{expected.impressionText}”</blockquote>
          </figure>
        )}
        <VerdictQuestion
          id={`${id}-comparison`}
          title="Compared to your first impression, the game was:"
        >
          <ChoiceTags
            name={`${id}-comparison`}
            labelledBy={`${id}-comparison`}
            options={COMPARISONS}
            selected={verdict.comparison}
            onSelect={set('comparison')}
          />
        </VerdictQuestion>
        <VerdictQuestion id={`${id}-change`} title="How did your impression change after playing?">
          <Textarea
            label="How did your impression change after playing?"
            className={styles.hiddenLabel}
            rows={3}
            maxLength={2000}
            value={verdict.changeText ?? ''}
            onChange={(e) => set('changeText')(e.target.value)}
          />
        </VerdictQuestion>
      </>
    );
  }

  if (step === 2) {
    return [
      ['actualDifficulty', 'How difficult was the game?', DIFFICULTIES, expected.difficulty],
      ['actualStrength', 'What was the strongest part?', STRENGTHS, expected.strength],
      ['actualAudience', 'Who is this game made for?', AUDIENCES, expected.audience],
    ].map(([field, title, options, before]) => (
      <VerdictQuestion
        key={field}
        id={`${id}-${field}`}
        title={title}
        hint={before && `You expected: ${optionLabel(options, before)}`}
      >
        <ChoiceTags
          name={`${id}-${field}`}
          labelledBy={`${id}-${field}`}
          options={options}
          selected={verdict[field]}
          onSelect={set(field)}
        />
      </VerdictQuestion>
    ));
  }

  if (step === 3) {
    return (
      <VerdictQuestion
        id={`${id}-enjoyment`}
        title="How much did you enjoy playing?"
        hint={excitementHint(review)}
      >
        <Slider
          {...ENJOYMENT}
          value={verdict.enjoyment}
          labelledBy={`${id}-enjoyment`}
          onChange={set('enjoyment')}
        />
      </VerdictQuestion>
    );
  }

  return (
    <VerdictQuestion id={`${id}-improve`} title="What should the developer improve first?">
      <ChoiceTags
        name={`${id}-improve`}
        labelledBy={`${id}-improve`}
        options={IMPROVE_CATEGORIES}
        selected={verdict.improveCategory}
        onSelect={set('improveCategory')}
      />
      <div className={styles.improveRow}>
        <TextField
          label="If other:"
          placeholder="Pick Other to describe it"
          maxLength={60}
          disabled={verdict.improveCategory !== 'other'}
          value={verdict.improveOther ?? ''}
          onChange={(e) => set('improveOther')(e.target.value)}
        />
        <Textarea
          label="Explain why:"
          rows={3}
          maxLength={2000}
          value={verdict.improveText ?? ''}
          onChange={(e) => set('improveText')(e.target.value)}
        />
      </div>
    </VerdictQuestion>
  );
}

// "Your excitement before playing: Very excited", from the First Impression excitement slider.
function excitementHint(review) {
  const question = review.form.firstImpression.questions.find(
    (q) => q.preset === 'excitement' && q.type === 'slider',
  );
  const answer = question && answerFor(review.firstImpression.answers, question.id);
  if (!answer) return undefined;
  const { min, step, valueLabels } = question.slider;
  const value = valueLabels?.[Math.round((answer.number - min) / step)] ?? answer.number;
  return `Your excitement before playing: ${value}`;
}
