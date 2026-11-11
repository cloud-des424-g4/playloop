import { cx } from '../../lib/cx.js';
import styles from './GlassPanel.module.css';

// Translucent container used across the screens.
// card: surface/card + soft glass (profile details, badges, review rows).
// panel: surface/frost + PlayLoop / panel glass and shadow (large page sections).
export function GlassPanel({ as: Component = 'div', variant = 'card', className, ...props }) {
  return <Component className={cx(styles.root, styles[variant], className)} {...props} />;
}
