const ANSWER_FIELDS = {
  short_answer: ['text'],
  paragraph: ['text'],
  multiple_choice: ['optionId', 'other'],
  dropdown: ['optionId'],
  checkboxes: ['optionIds', 'other'],
  linear_scale: ['number'],
  rating: ['number'],
  slider: ['number'],
  multiple_choice_grid: ['grid'],
  checkbox_grid: ['grid'],
};

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function valueProblem(question, answer) {
  const optionIds = question.options?.map((o) => o.id) ?? [];
  const { type } = question;

  if (type === 'short_answer' || type === 'paragraph') {
    return answer.text?.trim() ? null : 'Write an answer';
  }
  if (type === 'multiple_choice' || type === 'dropdown') {
    if (answer.optionId && answer.other) return 'Pick one option';
    if (answer.other) return question.allowOther ? null : 'This question has no Other option';
    return optionIds.includes(answer.optionId) ? null : 'Pick one of the options';
  }
  if (type === 'checkboxes') {
    if (answer.other && !question.allowOther) return 'This question has no Other option';
    const ids = answer.optionIds ?? [];
    if (!ids.length && !answer.other) return 'Pick at least one option';
    return ids.every((id) => optionIds.includes(id)) ? null : 'Unknown option';
  }
  if (type === 'linear_scale') {
    return isInt(answer.number, question.scale.min, question.scale.max) ? null : 'Out of range';
  }
  if (type === 'rating') {
    return isInt(answer.number, 1, question.rating.max) ? null : 'Out of range';
  }
  if (type === 'slider') {
    const { min, max, step } = question.slider;
    return isInt(answer.number, min, max) && (answer.number - min) % step === 0
      ? null
      : 'Out of range';
  }
  const rows = question.grid.rows.map((r) => r.id);
  const columns = question.grid.columns.map((c) => c.id);
  const entries = Object.entries(answer.grid ?? {});
  if (!entries.length) return 'Answer at least one row';
  const valid = entries.every(([row, value]) =>
    type === 'multiple_choice_grid'
      ? rows.includes(row) && columns.includes(value)
      : rows.includes(row) && Array.isArray(value) && value.every((c) => columns.includes(c)),
  );
  return valid ? null : 'Unknown row or column';
}

export function answerProblems(questions, answers, { complete }, path) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const problems = [];
  const seen = new Set();

  answers.forEach((answer, i) => {
    const at = `${path}/${i}`;
    const question = byId.get(answer.questionId);
    if (!question) return problems.push({ path: at, message: 'Unknown question' });
    if (seen.has(answer.questionId)) {
      return problems.push({ path: at, message: 'Question answered twice' });
    }
    seen.add(answer.questionId);

    const allowed = ANSWER_FIELDS[question.type];
    const extra = Object.keys(answer).filter((k) => k !== 'questionId' && !allowed.includes(k));
    if (extra.length) return problems.push({ path: at, message: `Unexpected ${extra.join(', ')}` });

    const message = valueProblem(question, answer);
    if (message) problems.push({ path: at, message });
  });

  if (complete) {
    for (const question of questions) {
      if (question.required && !seen.has(question.id)) {
        problems.push({ path, message: `Answer "${question.title}"` });
      }
    }
  }
  return problems;
}

export function verdictProblems(verdict) {
  const checks = [
    [!verdict.comparison, '/body/comparison', 'Compare the game to your first impression'],
    [!verdict.changeText, '/body/changeText', 'Say how your impression changed'],
    [!verdict.enjoyment, '/body/enjoyment', 'Rate how much you enjoyed it'],
    [!verdict.improveCategory, '/body/improveCategory', 'Pick what to improve first'],
    [
      verdict.improveCategory === 'other' && !verdict.improveOther,
      '/body/improveOther',
      'Describe what to improve',
    ],
    [!verdict.improveText, '/body/improveText', 'Explain why'],
  ];
  return checks.filter(([failed]) => failed).map(([, path, message]) => ({ path, message }));
}
