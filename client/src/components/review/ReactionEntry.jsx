import { ReactionTag } from '../ui/Tag.jsx';
import { cx } from '../../lib/cx.js';
import styles from './ReactionEntry.module.css';

// Timestamped reaction logged during a playtest. Figma: Handoff / Reaction entry (426:1579).
// `kind` is one of the shared CARD_TYPES: enjoyed | confused | bug.
export function ReactionEntry({ kind, timestamp, comment, className }) {
  return (
    <div className={cx(styles.entry, className)}>
      <div className={styles.top}>
        <ReactionTag kind={kind} />
        <span className={styles.timestamp}>{timestamp}</span>
      </div>
      {comment && <p className={styles.comment}>{comment}</p>}
    </div>
  );
}
