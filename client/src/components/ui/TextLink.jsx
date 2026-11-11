import { cx } from '../../lib/cx.js';
import styles from './TextLink.module.css';

// Inline navigation link. Figma: Handoff / Text link (426:1519). Use `as={Link}` for app routes.
// `size="sm"` is the 16 px medium link inside a sentence; `underline` keeps the underline on at rest
// (Sign up, Log in and Forgot password links).
export function TextLink({
  as: Component = 'a',
  size = 'md',
  underline = false,
  className,
  ...props
}) {
  return (
    <Component
      className={cx(
        styles.link,
        size === 'sm' && styles.sm,
        underline && styles.underline,
        className,
      )}
      {...props}
    />
  );
}
