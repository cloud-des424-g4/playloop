export const questionTypes = [
  ['short_answer', 'Fill in the blank'],
  ['paragraph', 'Paragraph'],
  ['multiple_choice', 'Multiple choice'],
  ['checkboxes', 'Checkboxes'],
  ['dropdown', 'Dropdown'],
  ['linear_scale', 'Linear scale'],
  ['rating', 'Rating'],
  ['slider', 'Slider'],
  ['multiple_choice_grid', 'Multiple choice grid'],
  ['checkbox_grid', 'Checkbox grid'],
].map(([value, label]) => ({ value, label }));
export const newId = () => crypto.randomUUID();
export const newOption = (label = '') => ({ id: newId(), label });
export const newQuestion = () => ({ id: newId(), type: 'short_answer', title: '', required: true });
export function changeType(question, type) {
  const { id, title, description, required } = question;
  const base = { id, title, required, ...(description !== undefined && { description }), type };
  if (['multiple_choice', 'checkboxes', 'dropdown'].includes(type))
    base.options = [newOption('Option 1'), newOption('Option 2')];
  if (type === 'linear_scale') base.scale = { min: 1, max: 5 };
  if (type === 'rating') base.rating = { max: 5, icon: 'star' };
  if (type === 'slider') base.slider = { min: 1, max: 5, step: 1 };
  if (type.endsWith('_grid'))
    base.grid = {
      rows: [newOption('Row 1')],
      columns: [newOption('Column 1'), newOption('Column 2')],
    };
  return base;
}
export function validateForm(form) {
  for (const [section, title] of [
    ['firstImpression', 'First Impression'],
    ['playtest', 'Playtest'],
  ]) {
    for (const [i, q] of form[section].questions.entries()) {
      const prefix = `${title}, question ${i + 1}`;
      if (!q.title.trim()) return `${prefix}: add a question.`;
      if (q.options && (q.options.length < 2 || q.options.some((o) => !o.label.trim())))
        return `${prefix}: add at least two non-empty options.`;
      if (
        q.grid &&
        (!q.grid.rows.length ||
          q.grid.columns.length < 2 ||
          [...q.grid.rows, ...q.grid.columns].some((o) => !o.label.trim()))
      )
        return `${prefix}: add a row and two columns with labels.`;
      const range = q.slider || q.scale;
      if (
        range &&
        (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.max <= range.min)
      )
        return `${prefix}: maximum must be greater than minimum.`;
      if (q.scale && (![0, 1].includes(q.scale.min) || q.scale.max < 2 || q.scale.max > 10))
        return `${prefix}: use a minimum of 0 or 1 and a maximum from 2 to 10.`;
      if (
        q.slider &&
        (!Number.isInteger(q.slider.step) ||
          q.slider.step < 1 ||
          (q.slider.max - q.slider.min) % q.slider.step !== 0)
      )
        return `${prefix}: step must divide the range evenly.`;
      if (q.rating && (!Number.isInteger(q.rating.max) || q.rating.max < 3 || q.rating.max > 10))
        return `${prefix}: rating must have 3 to 10 values.`;
    }
  }
  if (
    form.playtest.missions.some(
      (m) => !m.title.trim() || !Number.isInteger(m.minutes) || m.minutes < 1 || m.minutes > 600,
    )
  )
    return 'Playtest: each mission needs a title and a time from 1 to 600 minutes.';
  if (form.playtest.knownIssues.some((issue) => !issue.trim()))
    return 'Playtest: fill in or remove empty known issues.';
  return '';
}
export function formPayload(form) {
  return {
    firstImpression: form.firstImpression,
    playtest: form.playtest,
    finalVerdict: form.finalVerdict,
  };
}
