import { Select, Tag, TextField, Textarea } from '../../components/index.js';
import { cx } from '../../lib/cx.js';
import styles from './Review.module.css';

const RATING_ICONS = { star: '★', heart: '♥', thumb: '👍' };

// Answer control for one PlayLoop form question (docs/api form.yaml). `labelledBy` points at the
// visible question title. Every change calls onChange with the whole Answer object.
export function QuestionInput({ question, answer, onChange, labelledBy }) {
  const base = { questionId: question.id };
  const set = (patch) => onChange({ ...base, ...patch });
  const name = `question-${question.id}`;

  switch (question.type) {
    case 'short_answer':
      return (
        <TextField
          label="Your answer"
          className={styles.hiddenLabel}
          aria-labelledby={labelledBy}
          maxLength={5000}
          value={answer?.text ?? ''}
          onChange={(e) => set({ text: e.target.value })}
        />
      );
    case 'paragraph':
      return (
        <Textarea
          label="Your answer"
          className={styles.hiddenLabel}
          aria-labelledby={labelledBy}
          rows={4}
          maxLength={5000}
          value={answer?.text ?? ''}
          onChange={(e) => set({ text: e.target.value })}
        />
      );
    case 'multiple_choice':
    case 'checkboxes': {
      const multiple = question.type === 'checkboxes';
      const selected = multiple ? (answer?.optionIds ?? []) : answer?.optionId;
      const toggle = (id) =>
        multiple
          ? set({
              optionIds: selected.includes(id)
                ? selected.filter((v) => v !== id)
                : [...selected, id],
              ...(answer?.other && { other: answer.other }),
            })
          : set({ optionId: id });
      return (
        <div className={styles.stack}>
          <ChoiceTags
            name={name}
            multiple={multiple}
            labelledBy={labelledBy}
            options={question.options.map(({ id, label }) => [id, label])}
            selected={selected}
            onSelect={toggle}
          />
          {question.allowOther && (
            <TextField
              label="Other"
              maxLength={200}
              value={answer?.other ?? ''}
              onChange={(e) =>
                set({
                  ...(multiple ? { optionIds: selected } : {}),
                  other: e.target.value,
                })
              }
            />
          )}
        </div>
      );
    }
    case 'dropdown':
      return (
        <Select
          aria-labelledby={labelledBy}
          placeholder="Choose an answer"
          value={answer?.optionId ?? ''}
          options={question.options.map(({ id, label }) => ({ value: id, label }))}
          onChange={(e) => set({ optionId: e.target.value })}
        />
      );
    case 'linear_scale': {
      const { min, max, minLabel, maxLabel } = question.scale;
      return (
        <div className={styles.stack}>
          <ChoiceTags
            name={name}
            labelledBy={labelledBy}
            options={range(min, max).map((n) => [n, String(n)])}
            selected={answer?.number}
            onSelect={(n) => set({ number: n })}
          />
          {(minLabel || maxLabel) && (
            <p className={styles.caption}>
              {min}: {minLabel || '—'} · {max}: {maxLabel || '—'}
            </p>
          )}
        </div>
      );
    }
    case 'rating': {
      const icon = RATING_ICONS[question.rating.icon] ?? '★';
      return (
        <ChoiceTags
          name={name}
          labelledBy={labelledBy}
          options={range(1, question.rating.max).map((n) => [n, `${icon} ${n}`])}
          selected={answer?.number}
          onSelect={(n) => set({ number: n })}
        />
      );
    }
    case 'slider':
      return (
        <Slider
          {...question.slider}
          value={answer?.number}
          labelledBy={labelledBy}
          onChange={(number) => set({ number })}
        />
      );
    case 'multiple_choice_grid':
    case 'checkbox_grid':
      return <GridInput question={question} answer={answer} onChange={set} name={name} />;
    default:
      return <p className={styles.caption}>This question type can’t be answered here yet.</p>;
  }
}

function range(min, max) {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

// Tag-shaped radio buttons or checkboxes. Figma marks the picked option with the orange tag tone.
// With `toneFor` every option keeps its own tone (the reaction picker) and the picked one is
// outlined, since that state is not designed.
export function ChoiceTags({
  name,
  options,
  selected,
  onSelect,
  multiple = false,
  labelledBy,
  toneFor,
}) {
  const isSelected = (value) => (multiple ? selected?.includes(value) : selected === value);
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={labelledBy}
      className={styles.choices}
    >
      {options.map(([value, label]) => {
        const checked = Boolean(isSelected(value));
        return (
          <label key={value} className={styles.choice}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={name}
              className="visually-hidden"
              checked={checked}
              onChange={() => onSelect(value)}
            />
            <Tag
              tone={toneFor ? toneFor(value) : checked ? 'orange' : 'neutral'}
              className={cx(toneFor && checked && styles.choiceOutlined)}
            >
              {label}
            </Tag>
          </label>
        );
      })}
    </div>
  );
}

// Figma "slider" (281:1000): 800 px track, blue fill, value tag above the thumb, end labels below.
// The thumb sits in the middle until the reviewer moves it; only then does it count as an answer.
export function Slider({
  min,
  max,
  step = 1,
  value,
  minLabel,
  maxLabel,
  valueLabels,
  labelledBy,
  onChange,
}) {
  const current = value ?? min + Math.round((max - min) / step / 2) * step;
  const percent = max > min ? ((current - min) / (max - min)) * 100 : 0;
  const valueText = valueLabels?.[Math.round((current - min) / step)] ?? String(current);
  return (
    <div className={styles.slider} style={{ '--slider-fill': `${percent}%` }}>
      <div className={styles.sliderValue} aria-hidden="true">
        {value !== undefined && (
          <Tag tone="blue" className={styles.sliderTag}>
            {valueText}
          </Tag>
        )}
      </div>
      <input
        type="range"
        className={cx(styles.range, value === undefined && styles.rangeUnset)}
        min={min}
        max={max}
        step={step}
        value={current}
        aria-labelledby={labelledBy}
        aria-valuetext={value === undefined ? 'Not answered' : valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onChange(Number(e.currentTarget.value))}
      />
      <div className={styles.sliderScale}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function GridInput({ question, answer, onChange, name }) {
  const multiple = question.type === 'checkbox_grid';
  const grid = answer?.grid ?? {};
  function pick(rowId, columnId) {
    const values = [grid[rowId] ?? []].flat();
    const next = multiple
      ? values.includes(columnId)
        ? values.filter((v) => v !== columnId)
        : [...values, columnId]
      : columnId;
    onChange({ grid: { ...grid, [rowId]: next } });
  }
  return (
    <div className={styles.gridWrap}>
      <table className={styles.gridTable}>
        <thead>
          <tr>
            <td />
            {question.grid.columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {question.grid.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              {question.grid.columns.map((column) => (
                <td key={column.id}>
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={`${name}-${row.id}`}
                    aria-label={`${row.label}: ${column.label}`}
                    checked={[grid[row.id] ?? []].flat().includes(column.id)}
                    onChange={() => pick(row.id, column.id)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
