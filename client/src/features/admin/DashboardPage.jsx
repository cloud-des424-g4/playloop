import { useState } from 'react';
import { Link } from 'react-router';
import { AdminMetric, Select, TextLink } from '../../components/index.js';
import { RequestState } from '../shared/FeatureUI.jsx';
import { useResource } from '../shared/useResource.js';
import { plural } from './adminModel.js';
import { AdminPage } from './adminUI.jsx';
import styles from './Admin.module.css';

const RANGES = [7, 30, 90].map((days) => ({ value: String(days), label: `Last ${days} days` }));
const SERIES = [
  { value: 'newUsers', label: 'New users' },
  { value: 'newGames', label: 'New games' },
  { value: 'submittedReviews', label: 'Reviews submitted' },
  { value: 'reports', label: 'Reports' },
];
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const sum = (days, key) => days.reduce((total, day) => total + day[key], 0);

// Admin dashboard (Figma 375:1089). The analytics panel charts GET /admin/stats daily activity.
export function DashboardPage() {
  const [days, setDays] = useState('7');
  const stats = useResource(`/admin/stats?days=${days}`);
  return (
    <AdminPage title="Admin Dashboard">
      <div className={styles.toolbar}>
        <Select
          aria-label="Period"
          options={RANGES}
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
      </div>
      <RequestState resource={stats}>
        {stats.data && <Stats stats={stats.data} days={Number(days)} />}
      </RequestState>
    </AdminPage>
  );
}

function Stats({ stats, days }) {
  const { totals, daily } = stats;
  return (
    <>
      <div className={styles.metrics}>
        <AdminMetric
          label="Total Users"
          value={totals.users.toLocaleString('en-GB')}
          trend={`+${sum(daily, 'newUsers')} in the last ${days} days`}
        />
        <AdminMetric
          label="Published Games"
          value={totals.publishedGames.toLocaleString('en-GB')}
          trend={`${plural(sum(daily, 'newGames'), 'new game')} in the last ${days} days`}
        />
        <AdminMetric
          label="Pending Reports"
          value={totals.openReports.toLocaleString('en-GB')}
          trend={
            totals.openReports ? (
              <TextLink as={Link} size="sm" to="/admin/reports">
                Needs review
              </TextLink>
            ) : (
              'Nothing to review'
            )
          }
        />
        <AdminMetric
          label="Active Bans"
          value={totals.bannedUsers.toLocaleString('en-GB')}
          trend={`${totals.suspendedUsers} suspended right now`}
        />
      </div>
      <section className={styles.card} aria-labelledby="analytics-title">
        <div>
          <h2 id="analytics-title">PLATFORM ANALYTICS</h2>
          <p className={styles.caption}>Activity in the last {days} days and the totals today.</p>
        </div>
        <div className={styles.analytics}>
          <DailyChart daily={daily} />
          <Overview totals={totals} />
        </div>
      </section>
    </>
  );
}

function DailyChart({ daily }) {
  const [series, setSeries] = useState('newUsers');
  const name = SERIES.find((option) => option.value === series).label;
  const max = Math.max(1, ...daily.map((day) => day[series]));
  // Label about seven bars however long the period is.
  const step = Math.ceil(daily.length / 7);
  return (
    <div className={styles.stack} style={{ gap: 16 }}>
      <div className={styles.between}>
        <h3 className={styles.chartHead}>Daily activity</h3>
        <Select
          aria-label="Activity"
          options={SERIES}
          value={series}
          onChange={(event) => setSeries(event.target.value)}
        />
      </div>
      <ol className={styles.chart} aria-label={`${name} per day`}>
        {daily.map((day, index) => {
          const text = dayLabel.format(new Date(`${day.date}T00:00:00Z`));
          return (
            <li key={day.date} title={`${text}: ${day[series]}`}>
              <span className="visually-hidden">
                {text}: {day[series]}
              </span>
              <span
                className={styles.bar}
                style={{ height: `${(day[series] / max) * 100}%` }}
                aria-hidden="true"
              />
              <span className={styles.tick} aria-hidden="true">
                {(daily.length - 1 - index) % step === 0 ? text : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <p className={styles.caption}>
        {sum(daily, series)} in total · busiest day {max === 1 && !sum(daily, series) ? 0 : max}
      </p>
    </div>
  );
}

function Overview({ totals }) {
  const rows = [
    ['Published games', totals.publishedGames, totals.games],
    [
      'Submitted reviews',
      totals.submittedReviews,
      totals.submittedReviews + totals.inProgressReviews,
    ],
    ['Pending reports', totals.openReports, Math.max(totals.openReports, 10)],
    ['Suspended or banned', totals.suspendedUsers + totals.bannedUsers, totals.users],
  ];
  return (
    <div className={styles.stack} style={{ gap: 16 }}>
      <div>
        <h3 className={styles.chartHead}>Platform activity</h3>
        <p className={styles.caption}>Current overview</p>
      </div>
      <dl className={styles.meters}>
        {rows.map(([name, value, of]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value.toLocaleString('en-GB')}</dd>
            <span className={styles.meter} aria-hidden="true">
              <span style={{ width: `${of ? Math.min(100, (value / of) * 100) : 0}%` }} />
            </span>
          </div>
        ))}
      </dl>
    </div>
  );
}
