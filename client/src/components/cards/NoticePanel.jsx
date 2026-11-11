import { cx } from '../../lib/cx.js';
import styles from './NoticePanel.module.css';

// Informational glass panel (Known issues on the playtest screen).
// Figma: Handoff / Notice panel (426:1588). Height follows the number of messages.
export function NoticePanel({ title, messages = [], footer, className }) {
  return (
    <section className={cx(styles.panel, className)}>
      <h3 className={styles.title}>{title}</h3>
      {messages.length > 0 && (
        <ul className={styles.messages}>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {footer && <p className={styles.footer}>{footer}</p>}
    </section>
  );
}
