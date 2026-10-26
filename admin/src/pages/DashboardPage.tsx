import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale, type Translations } from '../i18n/translations';
import { useAuth } from '../auth/AuthContext';
import type { DashboardContext } from '../layout/usePoiId';
import { getDashboard } from '../api/dashboard';
import { getDonationStats, getCampaigns } from '../api/donations';
import { getEvents } from '../api/events';
import type { Campaign, DashboardSummary, DonationStats, Event, ModuleType } from '../api/types';
import { formatMoney } from '../format';
import { typeName } from '../requestTypes';
import { occurrencesBetween } from '../schedule';

type T = ReturnType<typeof useI18n>['t'];

const MODULE_NAME_KEYS: Record<ModuleType, `moduleNames.${keyof Translations['moduleNames']}`> = {
  donations: 'moduleNames.donations',
  events: 'moduleNames.events',
  announcements: 'moduleNames.announcements',
  prayer_requests: 'moduleNames.prayerRequests',
  livestreams: 'moduleNames.livestream',
  community: 'moduleNames.community',
  requests: 'moduleNames.requests',
  mass_intentions: 'moduleNames.massIntentions',
  daily_readings: 'moduleNames.readings',
  messages: 'moduleNames.messages',
};

function moduleName(type: ModuleType, t: T): string {
  return t(MODULE_NAME_KEYS[type]);
}

const LIVE_STATUSES = new Set(['trial', 'active']);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Enough for a normal week; a place with a Mass every day still gets a
// readable list, and the rest is one click away on the Events page.
const WEEK_ROWS = 10;

type TodoRow = { key: string; count: number; title: string; meta: string; action: string; to: string };
type WeekRow = { key: string; at: Date; what: string; meta: string | null };

function timeAgo(iso: string, t: T): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return t('donations.minutesAgo', { n: Math.max(minutes, 1) });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('donations.hoursAgo', { n: hours });
  return t('donations.daysAgo', { n: Math.round(hours / 24) });
}

// "a, b" for two items, "a, b and 3 more" beyond that.
function listed(items: string[], t: T): string {
  const shown = items.slice(0, 2).join(' · ');
  return items.length > 2 ? `${shown} ${t('dashboard.andMore', { n: items.length - 2 })}` : shown;
}

// The events of the next seven days, repeating ones included.
function occurrencesThisWeek(events: Event[], now: Date): { event: Event; at: Date }[] {
  // The office's opening hours are not something that happens.
  const happenings = events.filter((event) => event.category !== 'office_hours');
  return occurrencesBetween(happenings, now, new Date(now.getTime() + WEEK_MS));
}

// Only work for the modules the place runs: a switched-off module leaves
// nothing to do, even if old requests or intentions are still on file.
function todoRows(
  summary: DashboardSummary,
  t: T,
  formatWhen: (iso: string) => string,
  isLive: (type: ModuleType) => boolean,
): TodoRow[] {
  const rows: TodoRow[] = [];
  const who = (r: { type: Parameters<typeof typeName>[0]; contactName: string }) =>
    `${typeName(r.type, t)}, ${r.contactName}`;
  const requestLink = (ids: string[]) => (ids.length === 1 ? `../requests/${ids[0]}` : '../requests');

  const requestsLive = isLive('requests');
  if (requestsLive && summary.newRequests.length) {
    rows.push({
      key: 'new',
      count: summary.newRequests.length,
      title: t('dashboard.newRequests'),
      meta: listed(summary.newRequests.map((r) => `${who(r)}, ${timeAgo(r.at, t)}`), t),
      action: t('dashboard.actionOpen'),
      to: requestLink(summary.newRequests.map((r) => r.id)),
    });
  }
  if (requestsLive && summary.awaitingReply.length) {
    rows.push({
      key: 'reply',
      count: summary.awaitingReply.length,
      title: t('dashboard.awaitingReply'),
      meta: listed(summary.awaitingReply.map((r) => `${who(r)}, ${timeAgo(r.at, t)}`), t),
      action: t('dashboard.actionReply'),
      to: requestLink(summary.awaitingReply.map((r) => r.id)),
    });
  }
  if (requestsLive && summary.documentsToCheck.length) {
    rows.push({
      key: 'documents',
      count: summary.documentsToCheck.length,
      title: t('dashboard.documentsToCheck'),
      meta: listed(summary.documentsToCheck.map((d) => `${d.label} (${who(d)})`), t),
      action: t('dashboard.actionCheck'),
      to: requestLink([...new Set(summary.documentsToCheck.map((d) => d.requestId))]),
    });
  }
  const toMark = summary.intentionsToMark.reduce((n, c) => n + c.count, 0);
  if (isLive('mass_intentions') && toMark) {
    rows.push({
      key: 'intentions',
      count: toMark,
      title: t('dashboard.intentionsToMark'),
      meta: listed(
        summary.intentionsToMark.map((c) =>
          [c.title ?? t('dashboard.mass'), c.at ? formatWhen(c.at) : null].filter(Boolean).join(', '),
        ),
        t,
      ),
      action: t('dashboard.actionMark'),
      to: '../mass-intentions',
    });
  }
  if (summary.expiredMessages.length) {
    rows.push({
      key: 'expired',
      count: summary.expiredMessages.length,
      title: t('dashboard.expiredMessages'),
      meta: listed(summary.expiredMessages.map((m) => `« ${m.text} »`), t),
      action: t('dashboard.actionEdit'),
      to: '../home-page',
    });
  }
  return rows;
}

export function DashboardPage() {
  const { poiId, modules } = useOutletContext<DashboardContext>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isLive = (type: ModuleType) =>
    !!modules?.some((m) => m.moduleType === type && LIVE_STATUSES.has(m.status));
  const givingLive = isLive('donations');

  useEffect(() => {
    setSummary(null);
    setError(null);
    getDashboard(poiId)
      .then(setSummary)
      .catch(() => setError(t('dashboard.loadError')));
    // The rest only fills in figures: the page stands without them.
    getEvents(poiId).then(setEvents).catch(() => setEvents([]));
  }, [poiId]);

  useEffect(() => {
    if (!givingLive) return;
    getDonationStats(poiId).then(setStats).catch(() => setStats(null));
    getCampaigns(poiId).then(setCampaigns).catch(() => setCampaigns([]));
  }, [poiId, givingLive]);

  const locale = language === 'en' ? 'en-GB' : intlLocale(language);
  const dayTime = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatWhen = (iso: string) => dayTime.format(new Date(iso));
  const today = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const place = user?.adminPois.find((p) => p.id === poiId)?.name;

  if (error) return <div><h2>{t('dashboard.title')}</h2><p className="error-text">{error}</p></div>;
  if (!summary) return <div><h2>{t('dashboard.title')}</h2><p className="muted">{t('dashboard.loading')}</p></div>;

  const now = new Date();
  const todos = todoRows(summary, t, formatWhen, isLive);
  // A free month ending within the week: the office decides on the
  // Modules page whether to keep the module.
  const endingTrials = (modules ?? []).filter(
    (m) => m.status === 'trial' && m.trialEndsAt && new Date(m.trialEndsAt).getTime() - now.getTime() < WEEK_MS,
  );
  if (endingTrials.length) {
    const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
    todos.push({
      key: 'trials',
      count: endingTrials.length,
      title: t('dashboard.trialsEnding'),
      meta: listed(endingTrials.map((m) => `${moduleName(m.moduleType, t)}, ${dayMonth.format(new Date(m.trialEndsAt!))}`), t),
      action: t('dashboard.actionSee'),
      to: '../modules',
    });
  }

  const week: WeekRow[] = [];
  const eventsLive = isLive('events');
  const requestsLive = isLive('requests');
  const intentionsAt = new Map((isLive('mass_intentions') ? summary.upcomingIntentions : []).filter((c) => c.at).map((c) => [new Date(c.at!).getTime(), c]));
  const intentionsWord = (n: number) =>
    n === 1 ? t('dashboard.intentionToRead') : t('dashboard.intentionsToRead', { n });
  for (const { event, at } of occurrencesThisWeek(eventsLive ? events : [], now)) {
    const intentions = intentionsAt.get(at.getTime());
    intentionsAt.delete(at.getTime());
    week.push({
      key: `${event.id}|${at.toISOString()}`,
      at,
      what: event.title,
      meta: intentions ? intentionsWord(intentions.count) : event.location,
    });
  }
  // Intentions for a time no event gives (typed in by hand at the office).
  for (const c of intentionsAt.values()) {
    week.push({ key: `intentions|${c.at}`, at: new Date(c.at!), what: c.title ?? t('dashboard.mass'), meta: intentionsWord(c.count) });
  }
  for (const a of requestsLive ? summary.appointments : []) {
    week.push({
      key: `appointment|${a.id}`,
      at: new Date(a.at),
      what: t('dashboard.appointment', { what: `${typeName(a.type, t)}, ${a.contactName}` }),
      meta: a.place,
    });
  }
  week.sort((a, b) => a.at.getTime() - b.at.getTime());

  const campaign = campaigns.find((c) => c.active && c.goalAmount);
  const monthDelta =
    stats && stats.lastMonth.total > 0
      ? ((stats.thisMonth.total - stats.lastMonth.total) / stats.lastMonth.total) * 100
      : null;

  return (
    <div className="dashboard">
      <h2>{user?.firstName ? t('dashboard.greeting', { name: user.firstName }) : t('dashboard.title')}</h2>
      <p className="muted">{[today.charAt(0).toUpperCase() + today.slice(1), place].filter(Boolean).join(' · ')}</p>

      <h3 className="section-title">
        {todos.length ? t('dashboard.todoTitleCount', { n: todos.reduce((n, r) => n + r.count, 0) }) : t('dashboard.todoTitle')}
      </h3>
      <div className="card card-list">
        {todos.length === 0 ? (
          <p className="todo-done">{t('dashboard.allDone')}</p>
        ) : (
          todos.map((row) => (
            <Link key={row.key} className="todo-row" to={row.to}>
              <span className="todo-count">{row.count}</span>
              <span className="todo-text">
                <span className="todo-title">{row.title}</span>
                <span className="todo-meta">{row.meta}</span>
              </span>
              <span className="todo-go">{row.action}</span>
            </Link>
          ))
        )}
      </div>

      <h3 className="section-title">{t('dashboard.figuresTitle')}</h3>
      <div className="kpi-row">
        {givingLive && stats && (
          <div className="stat-tile">
            <p className="stat-label">{t('dashboard.donationsThisMonth')}</p>
            <p className="stat-value">{formatMoney(stats.thisMonth.total)}</p>
            {monthDelta === null ? (
              <p className="stat-delta stat-delta-neutral">{t('dashboard.noComparison')}</p>
            ) : (
              <p className={`stat-delta ${monthDelta >= 0 ? 'stat-delta-up' : 'stat-delta-down'}`}>
                <span aria-hidden="true">{monthDelta >= 0 ? '▲' : '▼'}</span>
                {t('dashboard.vsLastMonth', { pct: Math.abs(monthDelta).toFixed(0) })}
              </p>
            )}
          </div>
        )}
        {givingLive && campaign && (
          <div className="stat-tile">
            <p className="stat-label">{campaign.title}</p>
            <p className="stat-value">{Math.round((campaign.raised / campaign.goalAmount!) * 100)} %</p>
            <div
              className="progress"
              role="progressbar"
              aria-label={t('campaigns.progressLabel', { title: campaign.title })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round((campaign.raised / campaign.goalAmount!) * 100))}
            >
              <span style={{ width: `${Math.min(100, (campaign.raised / campaign.goalAmount!) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="stat-tile">
          <p className="stat-label">{t('dashboard.members')}</p>
          <p className="stat-value">{summary.members.total}</p>
          <p className={`stat-delta ${summary.members.newThisWeek ? 'stat-delta-up' : 'stat-delta-neutral'}`}>
            {t('dashboard.newThisWeek', { n: summary.members.newThisWeek })}
          </p>
        </div>
        {isLive('prayer_requests') && (
          <div className="stat-tile">
            <p className="stat-label">{t('dashboard.prayerRequests')}</p>
            <p className="stat-value">{summary.prayerRequestsThisWeek}</p>
            <p className="stat-delta stat-delta-neutral">{t('dashboard.thisWeek')}</p>
          </div>
        )}
      </div>

      <h3 className="section-title">{t('dashboard.weekTitle')}</h3>
      <div className="card card-list">
        {week.length === 0 ? (
          <p className="todo-done">{t('dashboard.weekEmpty')}</p>
        ) : (
          <>
            {week.slice(0, WEEK_ROWS).map((row) => (
              <div key={row.key} className="week-row">
                <span className="week-when">{dayTime.format(row.at)}</span>
                <span className="todo-text">
                  <span>{row.what}</span>
                  {row.meta && <span className="todo-meta">{row.meta}</span>}
                </span>
              </div>
            ))}
            {eventsLive && week.length > WEEK_ROWS && (
              <Link className="week-more" to="../events">
                {t('dashboard.weekMore', { n: week.length - WEEK_ROWS })}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
