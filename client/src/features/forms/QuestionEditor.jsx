import {
  Button,
  CheckboxField,
  IconButton,
  Select,
  Textarea,
  TextField,
} from '../../components/index.js';
import { changeType, newOption, questionTypes } from './formModel.js';
import removeIcon from '../../assets/features/delete.svg';
import styles from '../shared/Features.module.css';

export function RemoveButton({ label, onClick, disabled }) {
  return (
    <IconButton className={styles.remove} label={label} onClick={onClick} disabled={disabled}>
      <img src={removeIcon} alt="" />
    </IconButton>
  );
}
function OptionEditor({ label, items, onChange, minimum = 2, maximum = 20 }) {
  return (
    <div className={styles.options}>
      <h4>{label}</h4>
      {items.map((item, i) => (
        <div className={styles.issueRow} key={item.id}>
          <TextField
            label={`${label} ${i + 1}`}
            value={item.label}
            maxLength={100}
            onChange={(e) =>
              onChange(items.map((o) => (o.id === item.id ? { ...o, label: e.target.value } : o)))
            }
          />
          <RemoveButton
            label={`Remove ${label.toLowerCase()} ${i + 1}`}
            disabled={items.length <= minimum}
            onClick={() => onChange(items.filter((o) => o.id !== item.id))}
          />
        </div>
      ))}
      <Button
        variant="glass"
        disabled={items.length >= maximum}
        onClick={() => onChange([...items, newOption()])}
      >
        + Add {label.toLowerCase()}
      </Button>
    </div>
  );
}
export function QuestionEditor({ question: q, index, onChange, onRemove }) {
  function update(patch) {
    onChange({ ...q, ...patch });
  }
  const rangeKey = q.slider ? 'slider' : q.scale ? 'scale' : null;
  return (
    <article className={styles.question} aria-label={`Question ${index + 1}`}>
      <div className={styles.questionHead}>
        <strong>{String(index + 1).padStart(2, '0')}</strong>
        <span className={styles.caption}>Answer type</span>
        <Select
          aria-label={`Answer type for question ${index + 1}`}
          options={questionTypes}
          value={q.type}
          onChange={(e) => onChange(changeType(q, e.target.value))}
        />
        <RemoveButton label={`Remove question ${index + 1}`} onClick={onRemove} />
      </div>
      <TextField
        label="Question"
        value={q.title}
        maxLength={200}
        onChange={(e) => update({ title: e.target.value })}
      />
      {q.description !== undefined && (
        <Textarea
          label="Description"
          value={q.description || ''}
          maxLength={500}
          onChange={(e) => update({ description: e.target.value })}
        />
      )}
      {q.options && (
        <>
          <OptionEditor
            label="Option"
            items={q.options}
            onChange={(options) => update({ options })}
          />
          {q.type !== 'dropdown' && (
            <CheckboxField
              label="Allow an Other answer"
              checked={q.allowOther || false}
              onChange={(e) => update({ allowOther: e.target.checked })}
            />
          )}
        </>
      )}
      {rangeKey && (
        <div className={styles.row}>
          {['min', 'max', ...(rangeKey === 'slider' ? ['step'] : [])].map((key) => (
            <TextField
              key={key}
              label={{ min: 'Minimum', max: 'Maximum', step: 'Step' }[key]}
              type="number"
              step="1"
              value={q[rangeKey][key]}
              onChange={(e) => {
                const range = { ...q[rangeKey], [key]: Number(e.target.value) };
                delete range.valueLabels;
                update({ [rangeKey]: range });
              }}
            />
          ))}
        </div>
      )}
      {q.rating && (
        <div className={styles.row}>
          <TextField
            label="Rating maximum"
            type="number"
            min={3}
            max={10}
            value={q.rating.max}
            onChange={(e) => update({ rating: { ...q.rating, max: Number(e.target.value) } })}
          />
          <Select
            aria-label="Rating icon"
            options={['star', 'heart', 'thumb'].map((value) => ({ value, label: value }))}
            value={q.rating.icon}
            onChange={(e) => update({ rating: { ...q.rating, icon: e.target.value } })}
          />
        </div>
      )}
      {q.grid && (
        <>
          <OptionEditor
            label="Row"
            minimum={1}
            maximum={10}
            items={q.grid.rows}
            onChange={(rows) => update({ grid: { ...q.grid, rows } })}
          />
          <OptionEditor
            label="Column"
            maximum={10}
            items={q.grid.columns}
            onChange={(columns) => update({ grid: { ...q.grid, columns } })}
          />
        </>
      )}
      {['short_answer', 'paragraph'].includes(q.type) && (
        <div>
          <p className={styles.caption}>Answer (what reviewers see)</p>
          <div className={styles.preview}>Reviewers type their answer here.</div>
        </div>
      )}
      <CheckboxField
        label="Required question"
        checked={q.required}
        onChange={(e) => update({ required: e.target.checked })}
      />
    </article>
  );
}
