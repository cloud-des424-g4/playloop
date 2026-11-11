import { cx } from '../../lib/cx.js';
import styles from './Checkbox.module.css';

// Native checkbox styled as Figma Handoff / Checkbox (426:1499). Pair it with a visible label,
// or use CheckboxField.
export function Checkbox({ className, ...props }) {
  return <input type="checkbox" className={cx(styles.checkbox, className)} {...props} />;
}

// Checkbox with its label. Figma: Profile / Platform (220:395).
export function CheckboxField({ label, className, ...checkboxProps }) {
  return (
    <label className={cx(styles.field, className)}>
      <Checkbox {...checkboxProps} />
      <span>{label}</span>
    </label>
  );
}
