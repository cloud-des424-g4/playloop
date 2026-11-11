import { cx } from '../../lib/cx.js';
import styles from './Avatar.module.css';

// Portrait with the leaf shape. Figma: Profile / Portrait (218:313). Falls back to the initial
// avatar when the user has no picture.
export function Avatar({ src, name = '', size = 240, className }) {
  if (!src) return <InitialAvatar name={name} size={size} className={className} />;
  return (
    <img
      src={src}
      alt={name ? `${name}'s portrait` : ''}
      width={size}
      height={size}
      className={cx(styles.portrait, className)}
      style={{ '--avatar-size': `${size}px` }}
    />
  );
}

// Initial fallback. Figma: Handoff / Initial avatar (426:1605).
export function InitialAvatar({ name = '', size = 78, className }) {
  return (
    <span
      role="img"
      aria-label={name || 'User'}
      className={cx(styles.initial, className)}
      style={{ '--avatar-size': `${size}px` }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
