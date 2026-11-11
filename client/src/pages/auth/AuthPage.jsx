import { AuthIntro } from './AuthIntro.jsx';
import styles from './AuthPage.module.css';

// Two-column layout shared by Sign up and Log in: brand story on the left, the glass form (the
// children) on the right. Below 1100 px it becomes one column with the form right after the
// title and welcome line, and the artwork and tags underneath.
export function AuthPage({ title, message, children }) {
  return (
    <div className={styles.page}>
      <AuthIntro title={title} message={message} />
      <div className={styles.formSlot}>{children}</div>
    </div>
  );
}
