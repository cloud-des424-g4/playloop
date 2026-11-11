import { Tag } from '../ui/Tag.jsx';
import { cx } from '../../lib/cx.js';
import styles from './GameCard.module.css';

// Catalog game card from Browse Games. Figma: "game title" (178:230), populated as Nitro Phantom.
// `tags` is [{ label, tone }]. Use `as={Link}` + `to` to make the whole card a link.
export function GameCard({
  title,
  description,
  coverSrc,
  coverAlt = '',
  tags = [],
  as: Component = 'article',
  className,
  ...props
}) {
  return (
    <Component className={cx(styles.card, className)} {...props}>
      <img src={coverSrc} alt={coverAlt} className={styles.cover} />
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {tags.length > 0 && (
        <div className={styles.tags}>
          {tags.map(({ label, tone }) => (
            <Tag key={label} tone={tone}>
              {label}
            </Tag>
          ))}
        </div>
      )}
    </Component>
  );
}
