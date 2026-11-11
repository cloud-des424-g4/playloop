import { AchievementBadge } from '../ui/AchievementBadge.jsx';
import { cx } from '../../lib/cx.js';
import styles from './BadgeList.module.css';

// Earned badges strip. Figma: Profile / Badges (220:307). `badges` is [{ title, detail, icon }].
export function BadgeList({ badges, title = 'Badges', className }) {
  return (
    <section className={cx(styles.list, className)}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.count}>{badges.length} earned</p>
      </div>
      {badges.map((badge) => (
        <AchievementBadge key={badge.title} {...badge} className={styles.badge} />
      ))}
    </section>
  );
}
