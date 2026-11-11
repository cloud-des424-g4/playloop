import { cx } from '../../lib/cx.js';
import styles from './Keycap.module.css';

// Keyboard hint. Figma: "keycap" (196:126).
export function Keycap({ className, ...props }) {
  return <kbd className={cx(styles.key, className)} {...props} />;
}
