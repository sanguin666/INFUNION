import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOverview, type Overview, type WatchItem } from '../api/superadmin';
import { useSa, type Sa } from './format';

function watchText(item: WatchItem, { s, date, dateTime, moduleLabel, planLabel }: Sa): { title: string; detail: string } {
  const poi = item.poiName ?? '';
  switch (item.kind) {
    case 'trialEnding':
      return {
        title: item.plan
          ? s('watch.trialEndingPlan', { poi, plan: planLabel(item.plan) })
          : s('watch.trialEnding', { poi, module: moduleLabel(item.module ?? '') }),
        detail: s('watch.trialEndingDetail', { days: item.days ?? 0 }),
      };
    case 'requestsWaiting':
      return {
        title: s('watch.requestsWaiting', { poi, n: item.n ?? 0 }),
        detail: s('watch.requestsWaitingDetail', { days: item.days ?? 0 }),
      };
    case 'adminQuiet':
      return { title: s('watch.adminQuiet', { poi }), detail: s(item.never ? 'watch.adminQuietNever' : 'watch.adminQuietOld') };
    case 'suspended':
      return { title: s('watch.suspended', { poi }), detail: s('watch.suspendedDetail', { date: date(item.date) }) };
    case 'demoLogin':
      return { title: s('watch.demoLogin'), detail: s('watch.demoLoginDetail') };
    case 'errors':
      return { title: s('watch.errors', { n: item.n ?? 0 }), detail: s('watch.errorsDetail') };
    default:
      return { title: s('watch.ok'), detail: s('watch.okDetail', { date: dateTime(item.date) }) };
  }
}

/** Twelve months of module revenue, this month in orange. */
function RevenueChart({ data }: { data: Overview['revenue']['byMonth'] }) {
  const { s, money: eur, monthShort } = useSa();
  const width = 720;
  const height = 220;
  const top = 24;
  const bottom = 28;
  const max = Math.max(10, ...data.map((d) => d.total));
  const slot = width / data.length;
  const bar = Math.min(36, slot * 0.6);
  const scale = (value: number) => ((height - top - bottom) * value) / max;
  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={s('overview.chartLabel')}>
      <line x1={0} x2={width} y1={height - bottom} y2={height - bottom} stroke="var(--chart-axis)" strokeWidth={1} />
      <line x1={0} x2={width} y1={top} y2={top} stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray="3 4" />
      <text x={0} y={top - 6} className="chart-axis-label">{eur(max)}</text>
      {data.map((d, i) => {
        const h = scale(d.total);
        const x = i * slot + (slot - bar) / 2;
        const current = i === data.length - 1;
        return (
          <g key={d.month}>
            <title>{`${monthShort(d.month)}: ${eur(d.total)}`}</title>
            <rect
              x={x}
              y={height - bottom - h}
              width={bar}
              height={Math.max(h, d.total > 0 ? 2 : 0)}
              rx={4}
              fill={current ? 'var(--series-1)' : 'var(--color-primary-soft)'}
            />
            {d.total > 0 && (
              <text x={x + bar / 2} y={height - bottom - h - 6} textAnchor="middle" className="chart-axis-label">
                {eur(d.total)}
              </text>
            )}
            <text x={x + bar / 2} y={height - 8} textAnchor="middle" className="chart-axis-label">
              {monthShort(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const { s, money } = useSa();
  if (!before) return <p className="stat-delta stat-delta-neutral">{now ? s('overview.firstBilled') : s('overview.nothingLast')}</p>;
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <p className={`stat-delta ${pct >= 0 ? 'stat-delta-up' : 'stat-delta-down'}`}>
      {s('overview.vsLast', { pct: `${pct >= 0 ? '+' : ''}${pct}`, amount: money(before) })}
    </p>
  );
}

export function SuperadminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const sa = useSa();
  const { s, money: eur } = sa;

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(setError);
  }, []);

  if (error) return <div><h2>{s('overview.title')}</h2><p className="error-text">{sa.error(error)}</p></div>;
  if (!data) return <div><h2>{s('overview.title')}</h2><p className="muted">{s('common.loading')}</p></div>;

  const { revenue } = data;
  const monthName = new Intl.DateTimeFormat(sa.locale, { month: 'long' }).format(new Date());

  return (
    <div className="dashboard">
      <h2>{s('overview.title')}</h2>
      <p className="muted">{s('overview.envNote', { env: data.environment })}</p>

      <div className="kpi-row">
        <div className="stat-tile">
          <p className="stat-label">{s('overview.revenueOf', { month: monthName })}</p>
          <p className="stat-value">{eur(revenue.thisMonth)}</p>
          <Delta now={revenue.thisMonth} before={revenue.lastMonth} />
        </div>
        <div className="stat-tile">
          <p className="stat-label">{s('overview.mrr')}</p>
          <p className="stat-value">{eur(revenue.monthlyRecurring)}</p>
          <p className="stat-delta stat-delta-neutral">
            {s('overview.paidPlans', { n: revenue.paidPlans })}
          </p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{s('overview.communities')}</p>
          <p className="stat-value">{data.communities.total}</p>
          <p className="stat-delta stat-delta-neutral">
            {s('overview.communitiesSplit', { paying: data.communities.paying, comped: data.communities.comped })}
          </p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{s('overview.members')}</p>
          <p className="stat-value">{data.members.total}</p>
          <p className={`stat-delta ${data.members.newThisMonth ? 'stat-delta-up' : 'stat-delta-neutral'}`}>
            {s('overview.membersSplit', { n: data.members.newThisMonth, active: data.members.active30Days })}
          </p>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{s('overview.chartTitle')}</h3>
        </div>
        <RevenueChart data={revenue.byMonth} />
      </div>

      <div className="kpi-row">
        <div className="stat-tile">
          <p className="stat-label">{s('overview.trialPlans')}</p>
          <p className="stat-value">{revenue.trialPlans}</p>
          <p className="stat-delta stat-delta-neutral">{s('overview.trialsPotential', { amount: eur(revenue.trialPotential) })}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{s('overview.offered')}</p>
          <p className="stat-value">{revenue.offeredModules}</p>
          <p className="stat-delta stat-delta-neutral">{s('overview.offeredPlans', { n: revenue.offeredPlans })}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{s('overview.donations')}</p>
          <p className="stat-value">{eur(data.donations.thisMonth)}</p>
          <p className="stat-delta stat-delta-neutral">{s('overview.donationsCount', { n: data.donations.count })}</p>
          <p className="stat-delta stat-delta-neutral">{s('overview.donationsFee', { amount: eur(data.donations.fee ?? 0) })}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{s('overview.openRequests')}</p>
          <p className="stat-value">{data.requests.open}</p>
          <p className={`stat-delta ${data.requests.waitingOverAWeek ? 'stat-delta-down' : 'stat-delta-neutral'}`}>
            {s('overview.waitingRequests', { n: data.requests.waitingOverAWeek })}
          </p>
        </div>
      </div>

      <h3 className="section-title">{s('overview.watchTitle')}</h3>
      <div className="card card-list">
        {data.watch.map((item, i) => {
          const text = watchText(item, sa);
          const body = (
            <>
              <span className={`sa-dot sa-dot-${item.level}`} aria-hidden="true" />
              <span className="todo-text">
                <span className="todo-title">{text.title}</span>
                <span className="todo-meta">{text.detail}</span>
              </span>
              {item.poiId ? <span className="todo-go">{s('common.open')}</span> : <span />}
            </>
          );
          return item.poiId ? (
            <Link key={i} className="todo-row sa-watch-row" to={`../communities/${item.poiId}`}>
              {body}
            </Link>
          ) : (
            <div key={i} className="todo-row sa-watch-row">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
