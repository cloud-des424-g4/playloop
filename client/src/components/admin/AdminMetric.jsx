import { cx } from '../../lib/cx.js';
import styles from './AdminMetric.module.css';

// Dashboard stat card. Figma: Handoff / Admin metric (426:1628), rebuilt as a flexible card.
export function AdminMetric({ label, value, trend, className }) {
  return (
    <div className={cx(styles.metric, className)}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {trend && <p className={styles.trend}>{trend}</p>}
    </div>
  );
}
