import chevronIcon from '../../assets/icons/chevron.svg';
import { cx } from '../../lib/cx.js';
import styles from './Select.module.css';

// Closed select trigger. Figma: Handoff / Select trigger (426:1506). A native <select> gives
// keyboard selection and an accessible menu; the open-menu visual is not designed yet.
// Give it a name with `aria-label` or a <label htmlFor>.
export function Select({ options, placeholder, className, ...selectProps }) {
  const showPlaceholder =
    placeholder && selectProps.value === undefined && selectProps.defaultValue === undefined;

  return (
    <div className={cx(styles.wrapper, className)}>
      <select
        className={styles.select}
        {...(showPlaceholder && { defaultValue: '' })}
        {...selectProps}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <img src={chevronIcon} alt="" className={styles.chevron} />
    </div>
  );
}
