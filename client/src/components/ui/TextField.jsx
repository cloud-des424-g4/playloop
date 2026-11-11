import { useId } from 'react';
import { cx } from '../../lib/cx.js';
import styles from './Field.module.css';

// Labelled single-line input. Figma: Profile / Field (220:373).
// `radius="sm"` is the 8 px corner the Sign up and Log in instances override it with.
// An `error` normally replaces the `hint`; `keepHint` shows the hint under the error as well, for
// guidance that still applies when the value is wrong ("This can't be changed later").
export function TextField({
  label,
  hint,
  error,
  keepHint = false,
  id,
  radius = 'lg',
  className,
  ...inputProps
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hintId = `${inputId}-hint`;
  const message = error || hint;
  const showHintBelowError = keepHint && Boolean(error) && Boolean(hint);
  const describedBy = showHintBelowError
    ? `${messageId} ${hintId}`
    : message
      ? messageId
      : undefined;

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={cx(styles.control, radius === 'sm' && styles.controlSm)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
      {showHintBelowError && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
