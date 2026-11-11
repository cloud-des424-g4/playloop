import { ReactionTag, Tag } from '../../components/index.js';
import { label } from '../shared/format.js';
import styles from '../shared/Features.module.css';
import { answerText } from './answerText.js';

function Answers({ answers = [], questions = [] }) {
  return answers.map((answer) => {
    const question = questions.find((q) => q.id === answer.questionId);
    return (
      <div key={answer.questionId}>
        <dt>{question?.title || 'Question'}</dt>
        <dd>{answerText(answer, question)}</dd>
      </div>
    );
  });
}
export function ReviewDetails({ review }) {
  const verdict = review.finalVerdict || {};
  return (
    <div className={styles.stack}>
      <Tag className={styles.stageTag} tone="lilac">
        01 First Impression
      </Tag>
      <dl className={styles.answerBlock}>
        <Answers
          answers={review.firstImpression?.answers}
          questions={review.form?.firstImpression?.questions}
        />
      </dl>
      <Tag className={styles.stageTag} tone="lilac">
        02 Playtest
      </Tag>
      <div className={styles.answerBlock}>
        <h3 className={styles.caption}>Missions</h3>
        {review.playtest?.cards?.map((card) => (
          <div className={styles.missionAnswer} key={card.id}>
            <div className={styles.between}>
              <span>
                {review.form?.playtest?.missions.find((m) => m.id === card.missionId)?.title ||
                  'Playtest reaction'}
              </span>
              <ReactionTag kind={card.type} />
            </div>
            <p>{card.comment}</p>
          </div>
        ))}
        <dl className={styles.stack}>
          <Answers
            answers={review.developerAnswers?.answers}
            questions={review.form?.playtest?.questions}
          />
        </dl>
      </div>
      <Tag className={styles.stageTag} tone="lilac">
        03 Final Verdict
      </Tag>
      <dl className={styles.answerBlock}>
        <div>
          <dt>Compared to their first impression, the game was:</dt>
          <dd>{label(verdict.comparison) || 'Not answered'}</dd>
        </div>
        <div>
          <dt>How did their impression change after playing?</dt>
          <dd>{verdict.changeText || 'Not answered'}</dd>
        </div>
        {[
          ['Difficulty', 'difficulty', 'actualDifficulty'],
          ['Strongest part', 'strength', 'actualStrength'],
          ['Made for', 'audience', 'actualAudience'],
        ].map(([title, expected, actual]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd className={styles.row}>
              <Tag>Expected: {label(review.expectations?.[expected]) || 'Not answered'}</Tag>
              <Tag tone="orange">Actual: {label(verdict[actual]) || 'Not answered'}</Tag>
            </dd>
          </div>
        ))}
        <div>
          <dt>Enjoyment</dt>
          <dd>{verdict.enjoyment ? `${verdict.enjoyment} / 5` : 'Not answered'}</dd>
        </div>
        <div>
          <dt>What should you improve first?</dt>
          <dd>{verdict.improveText || 'Not answered'}</dd>
        </div>
      </dl>
    </div>
  );
}
