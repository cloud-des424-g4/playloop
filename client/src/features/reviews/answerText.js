// Readable text for one form answer (docs/api form.yaml Answer), used by the review details and
// the reviewer's summary.
export function answerText(answer, question) {
  if (answer.text !== undefined) return answer.text;
  const option = (id) => question?.options?.find((o) => o.id === id)?.label || id;
  if (answer.optionId) return option(answer.optionId);
  if (answer.optionIds)
    return [...answer.optionIds.map(option), answer.other].filter(Boolean).join(', ');
  if (answer.other) return answer.other;
  if (answer.number !== undefined)
    return (
      question?.slider?.valueLabels?.[
        (answer.number - question.slider.min) / question.slider.step
      ] ?? String(answer.number)
    );
  if (answer.grid)
    return Object.entries(answer.grid)
      .map(
        ([row, values]) =>
          `${question?.grid?.rows.find((r) => r.id === row)?.label || row}: ${[values]
            .flat()
            .map((value) => question?.grid?.columns.find((c) => c.id === value)?.label || value)
            .join(', ')}`,
      )
      .join('\n');
  return 'No answer';
}
