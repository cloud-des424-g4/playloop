import launchIcon from '../../assets/icons/upload.svg';
import reviewIcon from '../../assets/icons/review.svg';
import heartIcon from '../../assets/icons/heart.svg';
import { cx } from '../../lib/cx.js';
import styles from './AchievementBadge.module.css';

const ICONS = {
  launch: { src: launchIcon, tone: 'lime' },
  review: { src: reviewIcon, tone: 'lilac' },
  heart: { src: heartIcon, tone: 'sunny' },
};

// Earned achievement. Figma: Profile / Badge (220:300). `icon` is launch | review | heart.
export function AchievementBadge({ title, detail, icon = 'launch', className }) {
  const { src, tone } = ICONS[icon];
  return (
    <div className={cx(styles.badge, className)}>
      <span className={cx(styles.medal, styles[tone])}>
        <img src={src} alt="" />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        <p className={styles.detail}>{detail}</p>
      </div>
    </div>
  );
}
