import { cx } from '../../lib/cx.js';
import styles from './PrimaryButton.module.css';

// Primary page action with the orange-to-amber gradient. Figma: "primary button" (196:134).
// `size="md"` is the 20 px label used for Save Changes on forms. `fullWidth` stretches it to its
// container, as in the Sign up and Log in forms.
export function PrimaryButton({
  as: Component = 'button',
  size = 'lg',
  fullWidth = false,
  className,
  ...props
}) {
  const defaults = Component === 'button' ? { type: 'button' } : null;
  return (
    <Component
      {...defaults}
      className={cx(styles.button, styles[size], fullWidth && styles.fullWidth, className)}
      {...props}
    />
  );
}
