// Option lists for the Final Verdict and the summary. Keys are the API enums (docs/api enums.yaml).
export const COMPARISONS = [
  ['better', 'Better than expected'],
  ['as_expected', 'As expected'],
  ['worse', 'Worse than expected'],
  ['different', 'Different'],
];
export const DIFFICULTIES = [
  ['easy', 'Easy'],
  ['moderate', 'Moderate'],
  ['challenging', 'Challenging'],
  ['very_hard', 'Very Hard'],
];
export const STRENGTHS = [
  ['visuals', 'Visuals'],
  ['gameplay', 'Gameplay'],
  ['story', 'Story'],
  ['audio', 'Audio'],
  ['originality', 'Originality'],
];
export const AUDIENCES = [
  ['casual', 'Casual players'],
  ['experienced', 'Experienced players'],
  ['everyone', 'Everyone'],
  ['not_sure', 'Not sure'],
];
export const IMPROVE_CATEGORIES = [
  ['controls', 'Controls'],
  ['difficulty', 'Difficulty'],
  ['bugs', 'Bugs'],
  ['visuals', 'Visuals'],
  ['audio', 'Audio'],
  ['story', 'Story'],
  ['ui', 'UI'],
  ['other', 'Other'],
];
// Enjoyment is 1–5. Figma names the ends and the 4 ("A lot"); the middle labels fill the gaps.
export const ENJOYMENT = {
  min: 1,
  max: 5,
  step: 1,
  minLabel: 'Not at all',
  maxLabel: 'Loved it',
  valueLabels: ['Not at all', 'A little', 'Somewhat', 'A lot', 'Loved it'],
};

export const optionLabel = (list, key) => list.find(([value]) => value === key)?.[1] ?? '';

export const VERDICT_FIELDS = [
  'comparison',
  'changeText',
  'actualDifficulty',
  'actualStrength',
  'actualAudience',
  'enjoyment',
  'improveCategory',
  'improveOther',
  'improveText',
];

// Fields each Final Verdict step must have before Next (FinalVerdictInput: complete=true checks
// comparison, changeText, enjoyment, improveCategory and improveText).
export function verdictProblem(step, verdict) {
  if (step === 1 && !verdict.comparison)
    return 'Pick how the game compared with your first impression.';
  if (step === 1 && !verdict.changeText?.trim())
    return 'Tell the developer how your impression changed.';
  if (step === 3 && !verdict.enjoyment) return 'Move the slider to rate how much you enjoyed it.';
  if (step === 4 && !verdict.improveCategory)
    return 'Pick what the developer should improve first.';
  if (step === 4 && verdict.improveCategory === 'other' && !verdict.improveOther?.trim()) {
    return 'Describe what “Other” means.';
  }
  if (step === 4 && !verdict.improveText?.trim()) return 'Explain why.';
  return '';
}

export const answerFor = (answers, questionId) => answers.find((a) => a.questionId === questionId);

export function withAnswer(answers, answer) {
  return [...answers.filter((a) => a.questionId !== answer.questionId), answer];
}

export function isAnswered(question, answer) {
  if (!answer) return false;
  switch (question.type) {
    case 'short_answer':
    case 'paragraph':
      return Boolean(answer.text?.trim());
    case 'multiple_choice':
    case 'dropdown':
      return Boolean(answer.optionId || answer.other?.trim());
    case 'checkboxes':
      return Boolean(answer.optionIds?.length || answer.other?.trim());
    case 'linear_scale':
    case 'rating':
    case 'slider':
      return Number.isFinite(answer.number);
    case 'multiple_choice_grid':
    case 'checkbox_grid':
      return question.grid.rows.every((row) => [answer.grid?.[row.id] ?? []].flat().length > 0);
    default:
      return false;
  }
}

// What a stage save sends: only questions that have an answer, in form order.
export function answersPayload(questions, answers) {
  return questions
    .map((question) => answerFor(answers, question.id))
    .filter((answer, i) => isAnswered(questions[i], answer));
}

export function firstUnanswered(questions, answers) {
  const index = questions.findIndex((q) => !isAnswered(q, answerFor(answers, q.id)));
  return index === -1 ? Math.max(questions.length - 1, 0) : index;
}

// Where a resumed review opens. Answers are saved on every Next, so this picks up where the
// reviewer stopped.
export function resumeView(review) {
  const { form } = review;
  switch (review.currentStep) {
    case 'first_impression':
      return {
        step: 'first_impression',
        index: firstUnanswered(form.firstImpression.questions, review.firstImpression.answers),
      };
    case 'playtest':
      return { step: 'playtest' };
    case 'developer_questions':
      return {
        step: 'developer_questions',
        index: firstUnanswered(form.playtest.questions, review.developerAnswers.answers),
      };
    case 'final_verdict': {
      const step = [1, 2, 3, 4].find((n) => verdictProblem(n, review.finalVerdict));
      const started = VERDICT_FIELDS.some((field) => review.finalVerdict[field] !== undefined);
      if (started && step) return { step: 'final_verdict', index: step };
      return {
        step: 'final_verdict',
        index: form.finalVerdict.farewellMessage ? 'farewell' : 'intro',
      };
    }
    default:
      return { step: 'summary' };
  }
}

// Figma shows Leave only once a section's last question is reached (First Impression and the
// developer's questions), on the playtest, and on the summary. Final Verdict screens have none.
export function canLeave(view, review) {
  const { form } = review;
  if (view.step === 'first_impression') {
    return view.index >= form.firstImpression.questions.length - 1;
  }
  if (view.step === 'developer_questions') return view.index >= form.playtest.questions.length - 1;
  return view.step === 'playtest' || view.step === 'summary';
}

export const ownerName = (review) =>
  review.game.owner?.displayName || review.game.owner?.username || 'the developer';
