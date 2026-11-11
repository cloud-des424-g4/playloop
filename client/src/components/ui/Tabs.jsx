import { cx } from '../../lib/cx.js';
import styles from './Tabs.module.css';

const KEY_TARGETS = {
  ArrowLeft: (index) => index - 1,
  ArrowRight: (index) => index + 1,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

// Tab strip. Figma: "tab" (196:131), State=Selected|Default. Arrow keys move focus between tabs.
export function TabList({ label, className, children }) {
  function handleKeyDown(event) {
    const target = KEY_TARGETS[event.key];
    if (!target) return;
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')];
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    tabs[(target(index, tabs.length) + tabs.length) % tabs.length].focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx(styles.list, className)}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export function Tab({ selected = false, className, ...props }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={cx(styles.pill, styles.tab, selected && styles.selected, className)}
      {...props}
    />
  );
}

// Non-interactive status pill built on the tab shape (Pending / Resolve in the admin queue).
export function StatusBadge({ status = 'pending', className, ...props }) {
  return <span className={cx(styles.pill, styles[status], className)} {...props} />;
}
