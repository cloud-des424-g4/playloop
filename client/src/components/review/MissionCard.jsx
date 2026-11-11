import { cx } from '../../lib/cx.js';
import styles from './MissionCard.module.css';

const STATUS_TEXT = { available: 'Click to accept', accepted: 'Accepted' };

// Playtest mission. Figma: Handoff / Mission (426:1558), State=Available|Accepted.
// An available mission with `onAccept` renders as a button; the status text always shows.
export function MissionCard({
  title,
  duration,
  description,
  state = 'available',
  onAccept,
  className,
}) {
  const interactive = state === 'available' && onAccept;
  const Component = interactive ? 'button' : 'div';

  return (
    <Component
      {...(interactive && { type: 'button', onClick: onAccept })}
      className={cx(styles.card, styles[state], className)}
    >
      <span className={styles.top}>
        <span className={styles.title}>{title}</span>
        {duration && <span className={styles.duration}>{duration}</span>}
      </span>
      {description && <span className={styles.description}>{description}</span>}
      <span className={styles.status}>{STATUS_TEXT[state]}</span>
    </Component>
  );
}
