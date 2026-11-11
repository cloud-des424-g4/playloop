import { useId } from 'react';
import { Button, PrimaryButton, ReviewProgress } from '../../components/index.js';
import { cx } from '../../lib/cx.js';
import featureStyles from '../shared/Features.module.css';
import { QuestionInput } from './QuestionInput.jsx';
import { answerFor } from './reviewModel.js';
import styles from './Review.module.css';

// Stage title (Figma "stage", 281:717) with the progress pips under it.
export function StageHeading({ title, children }) {
  return (
    <div className={styles.stage}>
      <h1 className={featureStyles.title}>{title}</h1>
      {children}
    </div>
  );
}

// Back on the left, the primary action on the right (Figma "navigation", 281:734).
export function StepNav({ onBack, nextLabel = 'Next', onNext, busy, nextDisabled }) {
  return (
    <div className={styles.nav}>
      {onBack && (
        <Button variant="glass" onClick={onBack} disabled={busy}>
          Back
        </Button>
      )}
      <PrimaryButton
        size="md"
        className={styles.next}
        onClick={onNext}
        disabled={busy || nextDisabled}
      >
        {busy ? 'Saving…' : nextLabel}
      </PrimaryButton>
    </div>
  );
}

export function ErrorMessage({ children }) {
  return children ? (
    <p role="alert" className={featureStyles.error}>
      {children}
    </p>
  ) : null;
}

const TYPE_HINTS = {
  multiple_choice: 'Pick one.',
  dropdown: 'Pick one.',
  checkboxes: 'Pick all that apply.',
  linear_scale: 'Pick one.',
  rating: 'Pick one.',
};

// One question per screen, as in "Review: first impression q1–q5" (281:685–281:946) and
// "developer's question 1–2" (284:764, 284:814).
export function QuestionStep({
  title,
  questions,
  answers,
  index,
  progress,
  onAnswer,
  onBack,
  onNext,
  nextLabel,
  busy,
  error,
  emptyText,
}) {
  const id = useId();
  const question = questions[index];
  return (
    <div className={styles.screen}>
      <StageHeading title={title}>
        {question && (
          <ReviewProgress currentStep={index + 1} totalSteps={questions.length} text={progress} />
        )}
      </StageHeading>
      <section
        className={styles.card}
        aria-labelledby={question ? `${id}-title` : undefined}
        aria-label={question ? undefined : title}
      >
        {question ? (
          <>
            <h2 id={`${id}-title`} className={styles.questionTitle}>
              {question.title}
              {!question.required && <span className={styles.optional}> (optional)</span>}
            </h2>
            {(question.description || TYPE_HINTS[question.type]) && (
              <p className={styles.caption}>{question.description || TYPE_HINTS[question.type]}</p>
            )}
            <QuestionInput
              key={question.id}
              question={question}
              answer={answerFor(answers, question.id)}
              labelledBy={`${id}-title`}
              onChange={onAnswer}
            />
          </>
        ) : (
          <p className={styles.body}>{emptyText}</p>
        )}
      </section>
      <ErrorMessage>{error}</ErrorMessage>
      <StepNav onBack={onBack} nextLabel={nextLabel} onNext={onNext} busy={busy} />
    </div>
  );
}

// Glass card with the orange corner markers of the Final Verdict and summary frames.
export function MarkedCard({ as: Component = 'div', className, ...props }) {
  return <Component className={cx(styles.card, styles.marked, className)} {...props} />;
}
