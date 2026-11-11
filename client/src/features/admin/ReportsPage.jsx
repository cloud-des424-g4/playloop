import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import {
  Button,
  InitialAvatar,
  ReportRow,
  StatusBadge,
  Tab,
  TabList,
  Textarea,
  TextLink,
} from '../../components/index.js';
import { api } from '../../lib/api.js';
import { Pagination, RequestState } from '../shared/FeatureUI.jsx';
import { date, label, nameOf } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import {
  internalLink,
  plural,
  REASONS,
  targetTitle,
  useAction,
  useKeptData,
} from './adminModel.js';
import { AdminPage, Badge, HistoryList, Message, ReasonDialog, SuspendDialog } from './adminUI.jsx';
import styles from './Admin.module.css';

const STATUSES = ['open', 'resolved', 'dismissed'];
const reasonOf = (report) => REASONS[report.reason] || label(report.reason);

function ReportStatus({ status }) {
  return (
    <StatusBadge status={status === 'open' ? 'pending' : 'resolved'}>
      {status === 'open' ? 'Pending' : label(status)}
    </StatusBadge>
  );
}

// Report queue (Figma 405:1475): pick a report, then open it to moderate.
export function ReportQueuePage() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const reports = useResource(`/admin/reports?status=${status}&page=${page}&limit=10`);
  const items = reports.data?.items || [];
  const current = items.find((report) => report.id === selected) || items[0];
  return (
    <AdminPage title="Report Queue">
      <TabList label="Report status">
        {STATUSES.map((value) => (
          <Tab
            key={value}
            selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
              setSelected(null);
            }}
          >
            {value === 'open' ? 'Pending' : label(value)}
          </Tab>
        ))}
      </TabList>
      <RequestState resource={reports}>
        {items.length === 0 ? (
          <p className={styles.empty}>
            {status === 'open' ? 'No reports are waiting for review.' : `No ${status} reports.`}
          </p>
        ) : (
          <>
            {items.map((report) => (
              <ReportRow
                key={report.id}
                as="button"
                type="button"
                aria-pressed={current?.id === report.id}
                selected={current?.id === report.id}
                title={targetTitle(report.target)}
                metadata={`Reason: ${reasonOf(report)} · Author: ${
                  report.target.owner ? nameOf(report.target.owner) : 'unknown'
                } · ${plural(report.reportCount, 'open report')}`}
                status={<ReportStatus status={report.status} />}
                onClick={() => setSelected(report.id)}
              />
            ))}
            <Pagination
              data={reports.data}
              page={page}
              setPage={(next) => {
                setPage(next);
                setSelected(null);
              }}
            />
            {current && (
              <section className={styles.card} aria-label="Selected report">
                <h2 className={styles.heading2}>Selected report: {targetTitle(current.target)}</h2>
                <p className={styles.muted}>
                  Inspect the reported content before taking moderation action.
                </p>
                <Button
                  as={Link}
                  to={`/admin/reports/${current.id}`}
                  state={{ report: current }}
                  className={styles.fullWidth}
                >
                  Open Moderation
                </Button>
              </section>
            )}
          </>
        )}
      </RequestState>
    </AdminPage>
  );
}

// Report detail (Figma 2007:1718). The API has no single-report read, so the report comes from
// the queue: the latest 50, or the row the admin clicked.
export function ReportDetailPage() {
  const { reportId } = useParams();
  const { state } = useLocation();
  const reports = useKeptData(useResource('/admin/reports?page=1&limit=50'));
  const listed = reports.data?.items.find((item) => item.id === reportId);
  const report = listed || (state?.report?.id === reportId ? state.report : null);
  return (
    <AdminPage title="Report Queue">
      <TextLink as={Link} to="/admin/reports">
        ‹ Back to Report queue
      </TextLink>
      <RequestState resource={reports}>
        {report ? (
          <ReportDetail
            key={report.id}
            report={report}
            // Every report on the same content is handled together.
            group={(reports.data?.items || []).filter(
              (item) =>
                item.target.type === report.target.type && item.target.id === report.target.id,
            )}
            onChange={reports.refresh}
          />
        ) : (
          <p className={styles.empty}>
            This report isn’t in the latest 50. Open it from the report queue.
          </p>
        )}
      </RequestState>
    </AdminPage>
  );
}

function ReportDetail({ report, group, onChange }) {
  const { target } = report;
  const all = group.length ? group : [report];
  const open = all.filter((item) => item.status === 'open');
  // A report on a user has no owner: the target is the account itself.
  const owner =
    target.owner ||
    (target.type === 'user' ? { id: target.id, username: '', displayName: target.preview } : null);
  const isContent = target.type !== 'user';
  const [reason, setReason] = useState('');
  const [dialog, setDialog] = useState(null);
  const [done, setDone] = useState('');
  const [revision, setRevision] = useState(0);
  const action = useAction();
  const link = internalLink(target.link);
  const contentPath = `/admin/content/${target.type}/${target.id}`;

  async function close(status, note) {
    for (const item of open)
      await api.patch(`/admin/reports/${item.id}`, { status, ...(note && { note }) });
  }
  function finish(message) {
    setDone(message);
    setDialog(null);
    setRevision((value) => value + 1);
    onChange();
  }
  const act = (message, task) => async () => {
    setDone('');
    if (await action.run(task)) finish(message);
  };
  const hide = act('Hidden, and the reports are resolved.', async () => {
    await api.post(`${contentPath}/hide`, { reason: reason.trim() });
    await close('resolved', reason.trim());
  });
  const restore = act('Restored.', () => api.post(`${contentPath}/restore`));
  const dismiss = act(open.length > 1 ? 'Reports dismissed.' : 'Report dismissed.', () =>
    close('dismissed', reason.trim()),
  );

  return (
    <>
      <section className={styles.card} style={{ gap: 12 }}>
        <h2 className={styles.heading2}>{targetTitle(target)}</h2>
        <div className={styles.row}>
          <ReportStatus status={open.length ? 'open' : report.status} />
          {target.hidden && (
            <Badge tone="sunny" compact>
              Hidden
            </Badge>
          )}
          {target.removed && (
            <Badge tone="pink" compact>
              Removed
            </Badge>
          )}
          <span className={styles.muted}>
            {plural(all.length, 'report')} · first reported{' '}
            {date(
              all.reduce(
                (first, item) => (item.createdAt < first ? item.createdAt : first),
                report.createdAt,
              ),
            )}
          </span>
        </div>
      </section>

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h3>What players see</h3>
            {target.owner && (
              <div className={styles.row}>
                <InitialAvatar name={nameOf(owner)} size={56} />
                <div className={styles.stack} style={{ gap: 4 }}>
                  <span className={styles.cardTitle}>{nameOf(owner)}</span>
                  <span className={styles.caption}>
                    Level {target.owner.level} {target.owner.levelTitle} · {label(target.type)}
                  </span>
                </div>
              </div>
            )}
            <p className={styles.quote}>{target.preview}</p>
            {link && !target.removed && (
              <TextLink as={Link} to={link}>
                Open the {target.type}
              </TextLink>
            )}
          </section>

          <section className={styles.card}>
            <h3>Reports ({all.length})</h3>
            <ul
              className={`${styles.stack} ${styles.divided}`}
              style={{ listStyle: 'none', gap: 16 }}
            >
              {all.map((item) => (
                <li key={item.id} className={styles.stack} style={{ gap: 6 }}>
                  <span className={styles.caption}>
                    {nameOf(item.reporter)} · {reasonOf(item)} · {date(item.createdAt)}
                    {item.status !== 'open' && ` · ${label(item.status)}`}
                  </span>
                  <span className={item.details ? styles.body19 : styles.muted}>
                    {item.details || 'No note'}
                  </span>
                  {item.resolutionNote && (
                    <span className={styles.caption}>Admin note: {item.resolutionNote}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className={styles.column}>
          {owner && (
            <section className={styles.card} style={{ gap: 10 }}>
              <h3>Author</h3>
              <span className={styles.body19}>{nameOf(owner)}</span>
              {owner.username && <span className={styles.caption}>@{owner.username}</span>}
              <TextLink as={Link} to={`/admin/users/${owner.id}`}>
                Open user page
              </TextLink>
            </section>
          )}
          <section className={styles.card} style={{ gap: 10 }}>
            <h3>History</h3>
            <HistoryList key={revision} targetType={target.type} targetId={target.id} />
          </section>
        </div>
      </div>

      <section className={styles.card}>
        <h3>Take action</h3>
        <Message error={action.error} success={done} />
        {open.length === 0 ? (
          <p className={styles.muted}>
            {report.status === 'dismissed' ? 'Dismissed' : 'Resolved'}
            {report.resolvedBy && ` by ${nameOf(report.resolvedBy)}`}
            {report.resolvedAt && ` on ${date(report.resolvedAt)}`}.
          </p>
        ) : (
          <>
            <Textarea
              label="Reason, saved with the action"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className={styles.row}>
              {isContent && !target.removed && !target.hidden && (
                <Button disabled={!reason.trim() || action.busy} onClick={hide}>
                  Hide
                </Button>
              )}
              {isContent && !target.removed && (
                <Button disabled={action.busy} onClick={() => setDialog('remove')}>
                  Remove
                </Button>
              )}
              <button
                type="button"
                className={styles.linkButton}
                disabled={action.busy}
                onClick={dismiss}
              >
                {open.length > 1 ? `Dismiss ${open.length} reports` : 'Dismiss report'}
              </button>
              <span className={styles.grow} />
              {owner && (
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={action.busy}
                  onClick={() => setDialog('suspend')}
                >
                  Suspend or ban {nameOf(owner)}
                </button>
              )}
            </div>
            {isContent && (
              <p className={styles.caption}>
                Hide needs a reason: only the author can still see it, and it can be restored.
                Remove: gone for good.
              </p>
            )}
          </>
        )}
        {isContent && target.hidden && !target.removed && (
          <div className={styles.row}>
            <Button variant="glass" disabled={action.busy} onClick={restore}>
              Restore
            </Button>
          </div>
        )}
      </section>

      {dialog === 'remove' && (
        <ReasonDialog
          title={`Remove this ${target.type}?`}
          note="This can’t be undone. Removing a review also reverses the reputation it earned."
          confirmLabel="Remove for good"
          needsReason={false}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await api.delete(contentPath);
            await close('resolved', reason.trim() || 'Removed');
            finish('Removed, and the reports are resolved.');
          }}
        />
      )}
      {dialog === 'suspend' && (
        <SuspendDialog
          user={owner}
          onClose={() => setDialog(null)}
          onDone={async (_user, note) => {
            await close('resolved', note);
            finish(`${nameOf(owner)} is suspended or banned, and the reports are resolved.`);
          }}
        />
      )}
    </>
  );
}
