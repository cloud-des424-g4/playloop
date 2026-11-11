import { REACTIONS } from '../../lib/tagTones.js';
import { cx } from '../../lib/cx.js';
import styles from './Tag.module.css';

// Non-interactive label. Figma: "tag" (196:123). Tone is an instance override in Figma; see
// lib/tagTones.js for the genre pairings used on the screens.
export function Tag({ tone = 'neutral', size = 'md', className, ...props }) {
  return <span className={cx(styles.tag, styles[tone], styles[size], className)} {...props} />;
}

// Review reaction label (enjoyed | confused | bug).
export function ReactionTag({ kind, className }) {
  const { label, tone } = REACTIONS[kind];
  return (
    <Tag tone={tone} className={className}>
      {label}
    </Tag>
  );
}
