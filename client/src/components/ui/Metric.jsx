import { cx } from '../../lib/cx.js';
import styles from './Metric.module.css';

// Value with a caption. Figma: Profile / Metric (220:287).
export function Metric({ value, label, className }) {
  return (
    <div className={cx(styles.metric, className)}>
      <p className={styles.value}>{value}</p>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
