import { cx } from '../../lib/cx.js';
import styles from './ReviewCard.module.css';

// Published review row. Figma: Profile / Review (220:377).
// `action` is a slot for the link, e.g. <TextLink as={Link} to="/games/…">View game ↗</TextLink>.
export function ReviewCard({
  title,
  date,
  summary,
  helpful,
  coverSrc,
  coverAlt = '',
  action,
  className,
}) {
  return (
    <article className={cx(styles.card, className)}>
      <img src={coverSrc} alt={coverAlt} className={styles.cover} />
      <div className={styles.content}>
        <div className={styles.row}>
          <h3 className={styles.title}>{title}</h3>
          {date && <p className={styles.caption}>{date}</p>}
        </div>
        <p className={styles.summary}>{summary}</p>
        <div className={styles.row}>
          {helpful && <p className={styles.caption}>{helpful}</p>}
          {action}
        </div>
      </div>
    </article>
  );
}
