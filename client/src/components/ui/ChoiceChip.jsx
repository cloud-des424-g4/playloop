import { cx } from '../../lib/cx.js';
import styles from './ChoiceChip.module.css';

// Toggle chip from Playtest Roulette. Figma: wireframe / chip (356:1727), a legacy component.
export function ChoiceChip({ selected = false, className, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(styles.chip, selected && styles.selected, className)}
      {...props}
    />
  );
}
