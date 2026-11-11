import { useEffect, useId, useRef, useState } from 'react';
import { PrimaryButton, Textarea } from '../../components/index.js';
import { api } from '../../lib/api.js';
import { cx } from '../../lib/cx.js';
import { date, nameOf } from '../shared/format.js';
import { describeAction, useAction } from './adminModel.js';
import { useResource } from '../shared/useResource.js';
import styles from './Admin.module.css';

export function AdminPage({ title, lead, intro, children }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {lead && (
        <div className={styles.lead}>
          <h2>{lead}</h2>
          {intro && <p>{intro}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ tone, compact = false, children }) {
  return (
    <span className={cx(styles.badge, styles[tone], compact && styles.compact)}>{children}</span>
  );
}

const USER_TONES = { active: undefined, suspended: 'sunny', banned: 'pink' };
export const UserStatusBadge = ({ status, compact }) => (
  <Badge tone={USER_TONES[status]} compact={compact}>
    {status}
  </Badge>
);

export function Message({ error, success }) {
  if (error)
    return (
      <p role="alert" className={styles.error}>
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className={styles.success}>
        {success}
      </p>
    );
  return null;
}

// Modal dialog (Figma 2010:1841). Escape and the scrim close it; focus returns to the opener.
export function Dialog({ title, onClose, children }) {
  const titleId = useId();
  const panel = useRef(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement;
    panel.current?.focus();
    const onKey = (event) => event.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);
  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panel}
        className={styles.dialog}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Asks for the reason the API requires before hiding content; also used to confirm a removal.
export function ReasonDialog({
  title,
  note,
  confirmLabel,
  needsReason = true,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  const action = useAction();
  const ready = !needsReason || reason.trim().length > 0;
  return (
    <Dialog title={title} onClose={onClose}>
      {note && <p className={styles.caption}>{note}</p>}
      {needsReason && (
        <Textarea
          label="Reason (the owner sees this)"
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      )}
      <Message error={action.error} />
      <div className={styles.dialogActions}>
        <button type="button" className={styles.linkButton} onClick={onClose}>
          Cancel
        </button>
        <PrimaryButton
          size="md"
          disabled={!ready || action.busy}
          onClick={() => action.run(() => onConfirm(reason.trim()))}
        >
          {confirmLabel}
        </PrimaryButton>
      </div>
    </Dialog>
  );
}

const PENALTIES = [
  { value: '1', label: 'Suspend 1 day', confirm: 'Suspend for 1 day' },
  { value: '7', label: 'Suspend 7 days', confirm: 'Suspend for 7 days' },
  { value: '30', label: 'Suspend 30 days', confirm: 'Suspend for 30 days' },
  { value: 'ban', label: 'Ban', confirm: 'Ban permanently' },
];

// Suspend or ban (Figma 2010:1841). `until: null` is the API's permanent ban.
export function SuspendDialog({ user, onClose, onDone }) {
  const [penalty, setPenalty] = useState('7');
  const [reason, setReason] = useState('');
  const action = useAction();
  const chosen = PENALTIES.find((option) => option.value === penalty);
  async function submit() {
    const until =
      penalty === 'ban' ? null : new Date(Date.now() + Number(penalty) * 86_400_000).toISOString();
    const updated = await api.post(`/admin/users/${user.id}/suspend`, {
      reason: reason.trim(),
      until,
    });
    await onDone(updated, reason.trim());
  }
  return (
    <Dialog title={`Suspend or ban ${nameOf(user)}`} onClose={onClose}>
      <fieldset className={styles.options}>
        <legend>Choose one</legend>
        {PENALTIES.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="penalty"
              value={option.value}
              checked={penalty === option.value}
              onChange={() => setPenalty(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <p className={styles.caption}>
        Suspended and banned users can’t log in or act until it ends. A ban has no end date and
        hides their content.
      </p>
      <Textarea
        label="Reason (the user sees this)"
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Message error={action.error} />
      <div className={styles.dialogActions}>
        <button type="button" className={styles.linkButton} onClick={onClose}>
          Cancel
        </button>
        <PrimaryButton
          size="md"
          disabled={!reason.trim() || action.busy}
          onClick={() => action.run(submit)}
        >
          {chosen.confirm}
        </PrimaryButton>
      </div>
    </Dialog>
  );
}

// Admin actions, newest first. Pass a target to scope it to one game, review, reply or user.
// Remount it with a new `key` to reload after an action.
export function HistoryList({ targetType, targetId, limit = 5, empty }) {
  const scope = targetType && targetId ? `&targetType=${targetType}&targetId=${targetId}` : '';
  const history = useResource(`/admin/history?page=1&limit=${limit}${scope}`);
  if (history.loading) return <p className={styles.caption}>Loading history…</p>;
  if (history.error) return <p className={styles.caption}>History couldn’t be loaded.</p>;
  if (!history.data.items.length)
    return <p className={styles.caption}>{empty || 'No actions yet.'}</p>;
  return (
    <ul className={cx(styles.stack, styles.divided)} style={{ listStyle: 'none', gap: 16 }}>
      {history.data.items.map((item) => (
        <li key={item.id} className={styles.stack}>
          <span className={styles.caption}>{date(item.createdAt)}</span>
          <span>{describeAction(item)}</span>
          {item.reason && <span className={styles.caption}>“{item.reason}”</span>}
        </li>
      ))}
    </ul>
  );
}
