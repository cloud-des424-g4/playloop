import { GlassPanel, TextLink } from '../../components/index.js';
import { Link } from 'react-router';
import { cx } from '../../lib/cx.js';
import styles from './AuthCard.module.css';

// The glass form panel (Figma "Sign Up / glass form", 246:518, and "Log In / glass form", 246:585).
// `spacing` is the gap between rows: 16 on Sign up, 24 on Log in.
export function AuthCard({ spacing = 'tight', className, ...props }) {
  return (
    <GlassPanel
      as="form"
      noValidate
      className={cx(styles.card, styles[spacing], className)}
      {...props}
    />
  );
}

// Form-level problem (wrong password, rate limit, network). Field problems go on the field.
export function FormError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className={styles.formError}>
      {children}
    </p>
  );
}

// "Switch account flow": a caption and a link to the other screen.
export function SwitchFlow({ prompt, to, children }) {
  return (
    <p className={styles.switchFlow}>
      <span className={styles.prompt}>{prompt}</span>
      <TextLink as={Link} to={to} underline>
        {children}
      </TextLink>
    </p>
  );
}
