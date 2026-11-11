import { cx } from '../../lib/cx.js';
import styles from './Button.module.css';

// Compact action. Figma: "log in button" (196:120); `glass` is the Cancel / Edit Profile override
// and `pink` the review flow's Leave override (281:984).
// Pass `as={Link}` (react-router) or `as="a"` when it navigates instead of acting.
export function Button({ as: Component = 'button', variant = 'accent', className, ...props }) {
  const defaults = Component === 'button' ? { type: 'button' } : null;
  return (
    <Component {...defaults} className={cx(styles.button, styles[variant], className)} {...props} />
  );
}
