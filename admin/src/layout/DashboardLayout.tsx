import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Lockup } from '../components/LogoMark';
import { LanguagePicker } from '../components/LanguagePicker';
import { AppearancePicker } from '../components/AppearancePicker';
import { PickerRow, PickerSheet } from '../components/PickerSheet';
import { PlaceChip } from '../components/PlaceChip';
import { getWaitingByPlace, rememberPlace } from './placeSwitcher';
import { getActiveModules } from '../api/activeModules';
import { getPoi } from '../api/pois';
import { getMenuCounts, type MenuCounts } from '../api/dashboard';
import { getBilling } from '../api/billing';
import { LineIcon, MODULE_ICON, PAGE_ICON } from '../components/moduleIcons';
import { ClosingBanner } from './ClosingBanner';
import { WelcomeTour } from '../components/WelcomeTour';
import { superadminAskedForTour } from '../components/superadminTour';
import { AdminAssistant } from '../components/AdminAssistant';
import { PageTip, PAGE_TIPS } from '../components/PageTip';
import { getSuperadminSession } from '../api/client';
import type { ActiveModule, ModuleType } from '../api/types';
import type { Translations } from '../i18n/translations';
import type { DashboardContext } from './usePoiId';
import { useSa } from '../superadmin/format';

const LIVE_STATUSES = new Set(['trial', 'active']);

type NavLabel = `layout.${keyof Translations['layout']}`;
type NavItem = { to: string; label: NavLabel; icon: string; module?: ModuleType; count?: keyof MenuCounts };

// The menu in three parts (Seb chose option B, 3 Nov 2026): the
// community's own pages, then its active modules, then setup pinned at
// the bottom. A module's row only shows while the place runs it.
const TOP: NavItem[] = [
  { to: 'dashboard', label: 'layout.navDashboard', icon: PAGE_ICON.dashboard },
  { to: 'home-page', label: 'layout.navHomePage', icon: PAGE_ICON.homePage },
  // Always there: without the Messages module the page offers it.
  { to: 'members', label: 'layout.navMembers', icon: PAGE_ICON.members, count: 'messages' },
];

// From what a team checks daily to what it opens now and then.
const MODULE_NAV: (NavItem & { module: ModuleType })[] = [
  { to: 'requests', label: 'layout.navRequests', module: 'requests', icon: MODULE_ICON.requests, count: 'requests' },
  { to: 'events', label: 'layout.navEvents', module: 'events', icon: MODULE_ICON.events },
  { to: 'announcements', label: 'layout.navAnnouncements', module: 'announcements', icon: MODULE_ICON.announcements },
  { to: 'donations', label: 'layout.navDonations', module: 'donations', icon: MODULE_ICON.donations },
  { to: 'mass-intentions', label: 'layout.navMassIntentions', module: 'mass_intentions', icon: MODULE_ICON.mass_intentions, count: 'massIntentions' },
  { to: 'prayer-requests', label: 'layout.navPrayerRequests', module: 'prayer_requests', icon: MODULE_ICON.prayer_requests, count: 'prayerRequests' },
  { to: 'readings', label: 'layout.navReadings', module: 'daily_readings', icon: MODULE_ICON.daily_readings },
  { to: 'livestreams', label: 'layout.navLivestreams', module: 'livestreams', icon: MODULE_ICON.livestreams },
  { to: 'community', label: 'layout.navCommunity', module: 'community', icon: MODULE_ICON.community, count: 'community' },
];

const SETUP: NavItem[] = [
  { to: 'settings', label: 'layout.navSettings', icon: PAGE_ICON.settings },
  { to: 'modules', label: 'layout.navModules', icon: PAGE_ICON.plan },
  { to: 'my-qr', label: 'layout.navMyQr', icon: PAGE_ICON.qr },
];

export function DashboardLayout() {
  const { user, logout, seenTip, dismissTip } = useAuth();
  const { t } = useI18n();
  const { s: sa } = useSa();
  const navigate = useNavigate();
  const location = useLocation();
  const { poiId } = useParams<{ poiId: string }>();
  const [poiPickerOpen, setPoiPickerOpen] = useState(false);
  // Kept with the place they belong to, so switching places never shows
  // the last place's pages while the new list loads.
  const [loaded, setLoaded] = useState<{ poiId: string; modules: ActiveModule[] } | null>(null);
  const modules = loaded && loaded.poiId === poiId ? loaded.modules : null;

  const refreshModules = useCallback(() => {
    if (!poiId) return;
    getActiveModules(poiId)
      .then((list) => setLoaded({ poiId, modules: list }))
      // Only the pages that need a module go missing from the menu; the
      // rest of the dashboard works without this.
      .catch(() => setLoaded({ poiId, modules: [] }));
  }, [poiId]);

  useEffect(refreshModules, [refreshModules]);

  // "Add modules" under the list, for a community not on Complete (and
  // not on a plan infunion offers): it opens Plans & modules.
  const [canAddModules, setCanAddModules] = useState<{ poiId: string; yes: boolean } | null>(null);
  useEffect(() => {
    if (!poiId) return;
    getBilling(poiId)
      .then((b) => setCanAddModules({ poiId, yes: b.plan !== 'complete' && !b.planOffered && !b.comped }))
      .catch(() => setCanAddModules({ poiId, yes: false }));
  }, [poiId, modules]);

  // What waits on the team, beside its row. Read again on every page
  // change, so a request just answered drops off the count.
  const [counts, setCounts] = useState<{ poiId: string; counts: MenuCounts } | null>(null);
  useEffect(() => {
    if (!poiId) return;
    getMenuCounts(poiId)
      .then((c) => setCounts({ poiId, counts: c }))
      .catch(() => setCounts(null));
  }, [poiId, location.pathname]);

  // The superadmin opening a community it is not an admin of ("Ouvrir son
  // admin"): its name comes from the public directory.
  const memberPoi = user?.adminPois.find((p) => p.id === poiId);
  const manyPlaces = (user?.adminPois.length ?? 0) > 1;

  // An admin of several places comes back to the one they used last, and
  // sees beside each place what members are waiting on there.
  const [waiting, setWaiting] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!memberPoi) return;
    rememberPlace(memberPoi.id);
    if (!manyPlaces) return;
    getWaitingByPlace()
      .then((rows) => setWaiting(Object.fromEntries(rows.map((r) => [r.poiId, r.waiting]))))
      .catch(() => setWaiting({}));
  }, [memberPoi, manyPlaces, location.pathname]);
  const waitingElsewhere = Object.entries(waiting).some(([id, n]) => id !== poiId && n > 0);
  const [visitedName, setVisitedName] = useState<{ poiId: string; name: string } | null>(null);
  const visiting = !!user?.isSuperadmin && !!poiId && !memberPoi;
  useEffect(() => {
    if (!visiting || !poiId) return;
    getPoi(poiId)
      .then((poi) => setVisitedName({ poiId, name: poi.name }))
      .catch(() => setVisitedName({ poiId, name: '' }));
  }, [visiting, poiId]);

  if (!user) return null;
  if (visiting && !getSuperadminSession()) return <Navigate to={`/superadmin/communities/${poiId}`} replace />;

  const currentPoi =
    memberPoi ?? (visiting && visitedName?.poiId === poiId ? { id: poiId, name: visitedName.name } : undefined);

  function isLive(type: ModuleType) {
    return !!modules?.some((m) => m.moduleType === type && LIVE_STATUSES.has(m.status));
  }

  const moduleItems = MODULE_NAV.filter((item) => isLive(item.module));
  const showAddModules = !!canAddModules && canAddModules.poiId === poiId && canAddModules.yes;

  function navRow(item: NavItem, tour?: boolean) {
    const n = item.count && counts && counts.poiId === poiId ? counts.counts[item.count] : 0;
    return (
      <NavLink key={item.to} to={item.to} data-tour={tour ? item.to : undefined}>
        <LineIcon path={item.icon} />
        <span className="nav-label">{t(item.label)}</span>
        {n > 0 && (
          <span className="nav-count" aria-label={t('layout.waitingCount', { n })}>
            {n}
          </span>
        )}
      </NavLink>
    );
  }

  // A module switched off (here in Settings, or elsewhere) takes its page
  // with it: whoever is still on it goes back to the dashboard.
  const section = location.pathname.split('/')[3];
  const closedPage = MODULE_NAV.find((item) => item.to === section && item.module);
  if (modules && closedPage && !isLive(closedPage.module!)) {
    return <Navigate to={`/poi/${poiId}/dashboard`} replace />;
  }

  // The welcome tour, then a tip on each page the first time it opens
  // (Seb, 5 Nov 2026): for the community's own team. The superadmin
  // visiting gets them only after asking from Settings › "Tour and tips"
  // (Seb, 9 Nov 2026), for that browser session. The tour waits for the
  // modules so it lights the full list.
  const tipsOn = !!memberPoi || (visiting && superadminAskedForTour());
  const showTour = tipsOn && !!currentPoi && modules !== null && !seenTip('tour');
  const showPageTip = tipsOn && seenTip('tour') && section in PAGE_TIPS && !seenTip(`page:${section}`);

  function handlePoiChange(nextPoiId: string) {
    navigate(`/poi/${nextPoiId}/dashboard`);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <h1 aria-label="infunion Admin">
              <Lockup height={26} />
              <span>Admin</span>
            </h1>
          </div>
          <p className="sidebar-user">{user.firstName ?? user.email}</p>
        </div>

        <hr className="menu-divider" />

        {manyPlaces ? (
          <div className="poi-switcher">
            <p className="poi-switcher-caption">{t('layout.managing')}</p>
            <PickerRow
              icon={memberPoi ? <PlaceChip poi={memberPoi} /> : <span className="place-chip" />}
              label={currentPoi?.name ?? ''}
              value={
                waitingElsewhere
                  ? t('layout.placesWaiting', { n: user.adminPois.length })
                  : t('layout.placesCount', { n: user.adminPois.length })
              }
              ariaLabel={`${t('layout.managing')}: ${currentPoi?.name ?? ''}. ${t('layout.choosePlace')}`}
              onClick={() => setPoiPickerOpen(true)}
            />
            <PickerSheet
              open={poiPickerOpen}
              onClose={() => setPoiPickerOpen(false)}
              title={t('layout.choosePlace')}
              options={[...user.adminPois]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((poi) => ({
                  key: poi.id,
                  label: poi.name,
                  icon: <PlaceChip poi={poi} size={36} />,
                  badge: waiting[poi.id] ? (
                    <span className="place-waiting" aria-label={t('layout.waitingCount', { n: waiting[poi.id] })}>
                      {waiting[poi.id]}
                    </span>
                  ) : undefined,
                }))}
              selectedKey={poiId ?? ''}
              onChoose={handlePoiChange}
              closeLabel={t('layout.close')}
            />
          </div>
        ) : (
          currentPoi && <p className="poi-name">{currentPoi.name}</p>
        )}

        <hr className="menu-divider" />

        {user.isSuperadmin && (
          <>
            <nav>
              <NavLink to={visiting ? `/superadmin/communities/${poiId}` : '/superadmin'}>{sa('nav.title')}</NavLink>
            </nav>
            <hr className="menu-divider" />
          </>
        )}

        <div className="sidebar-nav">
          <nav aria-label={currentPoi?.name || undefined}>{TOP.map((item) => navRow(item, true))}</nav>
          <hr className="menu-divider" />
          <div data-tour="modules">
            <div className="nav-heading">
              <span id="nav-modules-heading">{t('layout.navModulesHeading')}</span>
              <Link to="modules" className="nav-heading-link">
                {t('layout.navManage')}
              </Link>
            </div>
            <nav aria-labelledby="nav-modules-heading">
              {moduleItems.map((item) => navRow(item))}
              {showAddModules && (
                <Link to="modules" className="nav-add">
                  <LineIcon path="M12 5v14M5 12h14" />
                  <span className="nav-label">{t('layout.navAddModules')}</span>
                </Link>
              )}
            </nav>
          </div>
        </div>

        <div className="sidebar-footer">
          <hr className="menu-divider" />
          <nav data-tour="setup">{SETUP.map((item) => navRow(item))}</nav>
          <LanguagePicker />
          <AppearancePicker />
          <button type="button" className="btn btn-destructive btn-block" onClick={logout}>
            {t('layout.signOut')}
          </button>
        </div>
      </aside>

      <main className="main">
        {poiId && <ClosingBanner poiId={poiId} />}
        {showPageTip && <PageTip page={section} onDismiss={() => dismissTip(`page:${section}`)} />}
        <Outlet context={{ poiId: poiId!, modules, refreshModules } satisfies DashboardContext} />
      </main>
      {/* Not while the tour runs. A visiting superadmin sees it too (Seb, 9 Nov 2026). */}
      {poiId && (memberPoi || visiting) && !showTour && <AdminAssistant poiId={poiId} />}
      {showTour && (
        <WelcomeTour firstName={user.firstName} communityName={currentPoi!.name} onDone={() => dismissTip('tour')} />
      )}
    </div>
  );
}
