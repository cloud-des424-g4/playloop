import { useId } from 'react';
import { cx } from '../../lib/cx.js';
import styles from './Field.module.css';

// Labelled multiline input. Figma: Profile / Field multiline (225:478).
export function Textarea({ label, hint, error, id, rows = 2, className, ...textareaProps }) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;
  const message = error || hint;

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={textareaId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...textareaProps}
      />
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
    </div>
  );
}
