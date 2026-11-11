import { cx } from '../../lib/cx.js';
import styles from './IconButton.module.css';

// Icon-only action. Figma: Handoff / Remove action (426:1514). The visible symbol is decorative,
// so `label` is required and becomes the accessible name (e.g. "Remove website").
export function IconButton({ label, children = '×', className, ...props }) {
  return (
    <button type="button" aria-label={label} className={cx(styles.button, className)} {...props}>
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
