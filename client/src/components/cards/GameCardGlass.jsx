import { Tag } from '../ui/Tag.jsx';
import { truncate } from '../../lib/format.js';
import { cx } from '../../lib/cx.js';
import styles from './GameCardGlass.module.css';

// Alternate glass card. Figma: Game card / glass (70:54). Kept separate from GameCard until the
// team agrees which variant each route uses. `moreLink` is rendered after a truncated description.
export function GameCardGlass({
  title,
  description,
  coverSrc,
  coverAlt = '',
  genres = [],
  platform,
  moreLink,
  maxDescriptionLength = 112,
  className,
}) {
  return (
    <article className={cx(styles.card, className)}>
      <img src={coverSrc} alt={coverAlt} className={styles.cover} />
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>
        {truncate(description, maxDescriptionLength)}
        {moreLink && <> {moreLink}</>}
      </p>
      {genres.length > 0 && (
        <div className={styles.chips}>
          {genres.map((genre) => (
            <Tag key={genre} size="sm" className={styles.genre}>
              {genre}
            </Tag>
          ))}
        </div>
      )}
      {platform && (
        <Tag size="sm" className={styles.platform}>
          {platform}
        </Tag>
      )}
    </article>
  );
}
