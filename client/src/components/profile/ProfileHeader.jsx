import { Avatar } from '../ui/Avatar.jsx';
import { Metric } from '../ui/Metric.jsx';
import { Tag } from '../ui/Tag.jsx';
import { cx } from '../../lib/cx.js';
import styles from './ProfileHeader.module.css';

const formatPoints = (points) => points.toLocaleString('en-US');

// Public profile header. Figma: Profile / Header (220:336). Composed from Avatar, Metric and Tag.
// `action` is a slot for Edit Profile (owner only); `tags` is [{ label, tone }];
// `website` is { href, label }.
export function ProfileHeader({
  displayName,
  pronouns,
  username,
  avatarUrl,
  level,
  levelTitle,
  points,
  nextLevelPoints,
  bio,
  stats = [],
  tags = [],
  website,
  action,
  className,
}) {
  const progress = nextLevelPoints ? Math.min(points / nextLevelPoints, 1) : 1;

  return (
    <section className={cx(styles.header, className)}>
      <div className={styles.portraitCard}>
        <Avatar src={avatarUrl} name={displayName} size={240} />
        <p className={styles.level}>
          Lv {level} · {levelTitle}
        </p>
        <div
          role="progressbar"
          aria-label="Level progress"
          aria-valuemin={0}
          aria-valuemax={nextLevelPoints ?? points}
          aria-valuenow={points}
          className={styles.track}
        >
          <span className={styles.fill} style={{ width: `${progress * 100}%` }} />
        </div>
        <p className={styles.points}>
          {nextLevelPoints
            ? `${formatPoints(points)} / ${formatPoints(nextLevelPoints)} pts`
            : `${formatPoints(points)} pts`}
        </p>
      </div>

      <div className={styles.identity}>
        <div className={styles.nameRow}>
          <div className={styles.name}>
            <h1 className={styles.displayName}>{displayName}</h1>
            {pronouns && <span className={styles.pronouns}>{pronouns}</span>}
          </div>
          {action}
        </div>
        <p className={styles.username}>@{username}</p>

        <div className={styles.details}>
          {stats.length > 0 && (
            <div className={styles.stats}>
              {stats.map(({ value, label }) => (
                <Metric key={label} value={value} label={label} className={styles.stat} />
              ))}
            </div>
          )}
          {bio && <p className={styles.bio}>{bio}</p>}
          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.map(({ label, tone }) => (
                <Tag key={label} tone={tone}>
                  {label}
                </Tag>
              ))}
            </div>
          )}
          {website && (
            <a href={website.href} className={styles.website} target="_blank" rel="noreferrer">
              {website.label} ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
