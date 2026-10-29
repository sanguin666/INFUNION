import { useEffect, useMemo, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { getDonationStats, getRecentDonations } from '../api/donations';
import type { DailyTotal, Donation, DonationStats } from '../api/types';
import { CURRENCY } from '../format';
import { CampaignsSection } from './CampaignsSection';
import { ReceiptsSection } from './ReceiptsSection';
import { TabBar, TabPanel, useTab } from '../components/Tabs';

const TABS = ['overview', 'campaigns', 'receipts'] as const;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCurrency(value: number, compact = false): string {
  return (compact ? compactCurrencyFormatter : currencyFormatter).format(value);
}

function parseDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateShort(dateKey: string): string {
  return parseDate(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateKey: string): string {
  return parseDate(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Round a chart-axis max up to a clean number (nearest 1/2/5 × a power of
// ten) so gridline labels read as €50 / €100, never €87.
function niceCeil(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// null means "no comparable prior period" (e.g. a brand-new community) —
// the caller shows a neutral state instead of a misleading ±∞%.
function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : null;
  return ((current - previous) / previous) * 100;
}

function DeltaLabel({ delta, comparedTo }: { delta: number | null; comparedTo: string }) {
  if (delta === null) {
    return (
      <p className="stat-delta stat-delta-neutral">
        <span aria-hidden="true">–</span> vs {comparedTo}
      </p>
    );
  }
  const up = delta >= 0;
  return (
    <p className={`stat-delta ${up ? 'stat-delta-up' : 'stat-delta-down'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {Math.abs(delta).toFixed(0)}% vs {comparedTo}
    </p>
  );
}

// 12-point sparkline: the trend rides in the de-emphasis gray, with only
// the most recent segment ("now") picked out in the accent — per the
// dataviz skill's stat-tile figure contract.
function Sparkline({ points }: { points: number[] }) {
  const width = 100;
  const height = 28;
  const max = Math.max(...points, 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((v, i) => [i * stepX, height - (v / max) * (height - 4) - 2]);
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
  const last = coords.length >= 2 ? coords.slice(-2) : null;

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="var(--chart-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {last && (
        <path
          d={`M${last[0][0]},${last[0][1]} L${last[1][0]},${last[1][1]}`}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function StatTile({
  label,
  value,
  delta,
  comparedTo,
  sparkline,
}: {
  label: string;
  value: string;
  delta: number | null;
  comparedTo: string;
  sparkline: number[];
}) {
  return (
    <div className="stat-tile">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <DeltaLabel delta={delta} comparedTo={comparedTo} />
      <Sparkline points={sparkline} />
    </div>
  );
}

const CHART_W = 720;
const CHART_H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function DonationChart({ data }: { data: DailyTotal[] }) {
  const { t } = useI18n();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const axisMax = useMemo(() => niceCeil(Math.max(...data.map((d) => d.total), 1)), [data]);

  const xFor = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * PLOT_W : 0);
  const yFor = (value: number) => PAD.top + PLOT_H - (value / axisMax) * PLOT_H;
  const baselineY = PAD.top + PLOT_H;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(d.total).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xFor(data.length - 1).toFixed(1)},${baselineY} L${xFor(0).toFixed(1)},${baselineY} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * axisMax);
  // First, middle, and last day only — labeling every one of 30 days would
  // collide and go unread.
  const xTickIndices = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width;
    const clampedX = Math.min(Math.max(relativeX, 0), 1);
    const index = Math.round(clampedX * (data.length - 1));
    setHoverIndex(index);
  }

  function handleKeyDown(event: React.KeyboardEvent<SVGRectElement>) {
    if (event.key === 'ArrowRight') {
      setHoverIndex((current) => Math.min((current ?? -1) + 1, data.length - 1));
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      setHoverIndex((current) => Math.max((current ?? data.length) - 1, 0));
      event.preventDefault();
    }
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const tooltipLeftPct = hoverIndex !== null ? (xFor(hoverIndex) / CHART_W) * 100 : 0;
  const tooltipTopPct = hovered ? (yFor(hovered.total) / CHART_H) * 100 : 0;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3>{t('donations.dailyDonationsTitle')}</h3>
        <span className="muted" style={{ fontSize: 13 }}>
          {t('donations.last30Days')}
        </span>
      </div>

      <div className="chart-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          role="img"
          aria-label={`${t('donations.dailyDonationsTitle')} — ${t('donations.last30Days')}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={yFor(t) + 4} textAnchor="end" className="chart-axis-label">
                {formatCurrency(t, true)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="var(--series-1)" fillOpacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          <line x1={PAD.left} x2={CHART_W - PAD.right} y1={baselineY} y2={baselineY} stroke="var(--chart-axis)" strokeWidth={1} />
          {xTickIndices.map((i) => (
            <text key={i} x={xFor(i)} y={CHART_H - 8} textAnchor="middle" className="chart-axis-label">
              {formatDateShort(data[i].date)}
            </text>
          ))}

          {hoverIndex !== null && hovered && (
            <>
              <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PAD.top} y2={baselineY} stroke="var(--chart-axis)" strokeWidth={1} />
              <circle cx={xFor(hoverIndex)} cy={yFor(hovered.total)} r={5} fill="var(--series-1)" stroke="var(--color-surface)" strokeWidth={2} />
            </>
          )}

          <rect
            x={PAD.left}
            y={0}
            width={PLOT_W}
            height={CHART_H}
            fill="transparent"
            tabIndex={0}
            aria-label="Chart data — use arrow keys to move between days"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            onKeyDown={handleKeyDown}
            onFocus={() => setHoverIndex((current) => current ?? data.length - 1)}
            onBlur={() => setHoverIndex(null)}
          />
        </svg>

        {hovered && (
          <div className="chart-tooltip" style={{ left: `${tooltipLeftPct}%`, top: `${tooltipTopPct}%` }}>
            <div className="chart-tooltip-value">{formatCurrency(hovered.total)}</div>
            <div className="chart-tooltip-label">
              {formatDateLong(hovered.date)} · {hovered.count} {t('donations.giftWord')}
              {hovered.count === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>

      <button type="button" className="table-toggle" onClick={() => setShowTable((v) => !v)}>
        {showTable ? t('donations.hideTableView') : t('donations.viewAsTable')}
      </button>

      {showTable && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('donations.dateHeader')}</th>
              <th>{t('donations.totalHeader')}</th>
              <th>{t('donations.giftsHeader')}</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.date}>
                <td>{formatDateLong(d.date)}</td>
                <td>{formatCurrency(d.total)}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// What a gift was for, as one short line under the giver's name.
function purposeLabel(donation: Donation, t: ReturnType<typeof useI18n>['t']): string {
  switch (donation.purpose) {
    case 'collection':
      return t('donations.purposeCollection');
    case 'campaign':
      return donation.campaign
        ? t('donations.purposeCampaignNamed', { title: donation.campaign.title })
        : t('donations.purposeCampaign');
    case 'mass_intention':
      return t('donations.purposeMassIntention');
    default:
      return t('donations.purposeGeneral');
  }
}

function timeAgo(iso: string, t: ReturnType<typeof useI18n>['t']): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return t('donations.minutesAgo', { n: Math.max(minutes, 1) });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('donations.hoursAgo', { n: hours });
  const days = Math.round(hours / 24);
  return t('donations.daysAgo', { n: days });
}

export function DonationsPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [recent, setRecent] = useState<Donation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useTab(TABS);

  useEffect(() => {
    setStats(null);
    setRecent(null);
    Promise.all([getDonationStats(poiId), getRecentDonations(poiId)])
      .then(([statsResult, recentResult]) => {
        setStats(statsResult);
        setRecent(recentResult);
      })
      .catch(() => setError(t('donations.loadError')));
  }, [poiId]);

  return (
    <div>
      <h2>{t('donations.title')}</h2>
      <p className="muted">{t('donations.subtitle')}</p>

      <TabBar
        idPrefix="donations"
        label={t('tabs.label')}
        current={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: t('tabs.donationsOverview') },
          { key: 'campaigns', label: t('tabs.donationsCampaigns') },
          { key: 'receipts', label: t('tabs.donationsReceipts') },
        ]}
      />

      <TabPanel idPrefix="donations" tabKey="overview" current={tab}>
        {error && <p className="error-text">{error}</p>}
        {!error && (!stats || !recent) && <p className="muted">{t('donations.loading')}</p>}
        {stats && recent && <DonationsOverview stats={stats} recent={recent} />}
      </TabPanel>

      <TabPanel idPrefix="donations" tabKey="campaigns" current={tab}>
        <CampaignsSection poiId={poiId} />
      </TabPanel>

      <TabPanel idPrefix="donations" tabKey="receipts" current={tab}>
        <ReceiptsSection poiId={poiId} />
      </TabPanel>
    </div>
  );
}

function DonationsOverview({ stats, recent }: { stats: DonationStats; recent: Donation[] }) {
  const { t } = useI18n();
  const last12 = stats.dailyTotals.slice(-12);
  const thisMonthAvg = stats.thisMonth.count > 0 ? stats.thisMonth.total / stats.thisMonth.count : 0;
  const lastMonthAvg = stats.lastMonth.count > 0 ? stats.lastMonth.total / stats.lastMonth.count : 0;
  const avgSparkline = last12.map((d) => (d.count > 0 ? d.total / d.count : 0));

  return (
    <>
      <div className="kpi-row">
        <StatTile
          label={t('donations.thisWeek')}
          value={formatCurrency(stats.thisWeek.total)}
          delta={computeDelta(stats.thisWeek.total, stats.lastWeek.total)}
          comparedTo={t('donations.vsLastWeek')}
          sparkline={last12.map((d) => d.total)}
        />
        <StatTile
          label={t('donations.thisMonth')}
          value={formatCurrency(stats.thisMonth.total)}
          delta={computeDelta(stats.thisMonth.total, stats.lastMonth.total)}
          comparedTo={t('donations.vsLastMonth')}
          sparkline={last12.map((d) => d.total)}
        />
        <StatTile
          label={t('donations.averageGift')}
          value={formatCurrency(thisMonthAvg)}
          delta={computeDelta(thisMonthAvg, lastMonthAvg)}
          comparedTo={t('donations.vsLastMonthAverage')}
          sparkline={avgSparkline}
        />
      </div>

      <DonationChart data={stats.dailyTotals} />

      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{t('donations.recentGiftsTitle')}</h3>
        </div>
        {recent.length === 0 ? (
          <p className="muted">{t('donations.noDonations')}</p>
        ) : (
          <div className="donation-list">
            {recent.map((donation) => (
              <div key={donation.id} className="donation-item">
                <span>
                  {donation.donorName ?? t('donations.anonymous')}
                  <span className="card-meta" style={{ display: 'block' }}>
                    {purposeLabel(donation, t)}
                    {donation.recurring && (
                      <>
                        {' · '}
                        <span className="badge badge-active">{t('donations.monthly')}</span>
                      </>
                    )}
                  </span>
                </span>
                <span>
                  <span className="donation-amount">{formatCurrency(donation.amount)}</span>{' '}
                  <span className="muted">· {timeAgo(donation.createdAt, t)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  );
}
