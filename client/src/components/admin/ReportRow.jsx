import { cx } from '../../lib/cx.js';
import styles from './ReportRow.module.css';

// Admin report queue row. Figma: Handoff / Report row (426:1636) for the selected state; other
// rows use the glass card surface on the Report Queue screen. `status` is a slot for StatusBadge.
export function ReportRow({
  title,
  metadata,
  status,
  selected = false,
  as: Component = 'div',
  className,
  ...props
}) {
  return (
    <Component className={cx(styles.row, selected && styles.selected, className)} {...props}>
      <span className={styles.title}>{title}</span>
      <span className={styles.metadata}>{metadata}</span>
      {status && <span className={styles.status}>{status}</span>}
    </Component>
  );
}
