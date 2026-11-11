import { formatPlaytime } from '../../lib/format.js';
import { cx } from '../../lib/cx.js';
import styles from './Playtime.module.css';

// Elapsed playtime chip from the review header. Figma: Handoff / Playtime (426:1526).
// Drive `seconds` from a real timer; it renders as mm:ss.
export function Playtime({ seconds, label = 'Playtime', className }) {
  return (
    <div className={cx(styles.playtime, className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} role="timer">
        {formatPlaytime(seconds)}
      </span>
    </div>
  );
}
