import { cx } from '../../lib/cx.js';
import styles from './Recommendation.module.css';

// Compact game row for the browse sidebar. Figma: Handoff / Recommendation (426:1598).
// When clickable, render the whole row as one link: `as={Link} to="/games/…"`.
// `tone` colours the metadata line; Explore Games (47:27) uses the genre's tone from toneForGenre().
export function Recommendation({
  title,
  metadata,
  coverSrc,
  coverAlt = '',
  tone = 'orange',
  as: Component = 'div',
  className,
  ...props
}) {
  return (
    <Component className={cx(styles.row, styles[tone], className)} {...props}>
      <img src={coverSrc} alt={coverAlt} width={56} height={56} className={styles.cover} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.metadata}>{metadata}</span>
      </span>
    </Component>
  );
}
