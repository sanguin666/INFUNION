import { useCallback, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { LogoMark } from '../components/LogoMark';
import { LanguagePicker } from '../components/LanguagePicker';
import { AppearancePicker } from '../components/AppearancePicker';
import { PickerRow, PickerSheet, PinIcon } from '../components/PickerSheet';
import { getActiveModules } from '../api/activeModules';
import { getPoi } from '../api/pois';
import { getSuperadminSession } from '../api/client';
import type { ActiveModule, ModuleType } from '../api/types';
import type { Translations } from '../i18n/translations';
import type { DashboardContext } from './usePoiId';
import { useSa } from '../superadmin/format';

const LIVE_STATUSES = new Set(['trial', 'active']);

// The sidebar in its order. A page tied to a module only shows while the
// place runs that module; the others (dashboard, home page, QR code,
// settings) are always there.
const NAV: { to: string; label: `layout.${keyof Translations['layout']}`; module?: ModuleType }[] = [
  { to: 'dashboard', label: 'layout.navDashboard' },
  { to: 'home-page', label: 'layout.navHomePage' },
  { to: 'requests', label: 'layout.navRequests', module: 'requests' },
  { to: 'donations', label: 'layout.navDonations', module: 'donations' },
  // Always there: without the Messages module the page offers it.
  { to: 'members', label: 'layout.navMembers' },
  { to: 'events', label: 'layout.navEvents', module: 'events' },
  { to: 'mass-intentions', label: 'layout.navMassIntentions', module: 'mass_intentions' },
  { to: 'readings', label: 'layout.navReadings', module: 'daily_readings' },
  { to: 'announcements', label: 'layout.navAnnouncements', module: 'announcements' },
  { to: 'livestreams', label: 'layout.navLivestreams', module: 'livestreams' },
  { to: 'prayer-requests', label: 'layout.navPrayerRequests', module: 'prayer_requests' },
  { to: 'community', label: 'layout.navCommunity', module: 'community' },
  { to: 'my-qr', label: 'layout.navMyQr' },
  { to: 'modules', label: 'layout.navModules' },
  { to: 'settings', label: 'layout.navSettings' },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
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

  // The superadmin opening a community it is not an admin of ("Ouvrir son
  // admin"): its name comes from the public directory.
  const memberPoi = user?.adminPois.find((p) => p.id === poiId);
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

  const navItems = NAV.filter((item) => !item.module || isLive(item.module));

  // A module switched off (here in Settings, or elsewhere) takes its page
  // with it: whoever is still on it goes back to the dashboard.
  const section = location.pathname.split('/')[3];
  const closedPage = NAV.find((item) => item.to === section && item.module);
  if (modules && closedPage && !isLive(closedPage.module!)) {
    return <Navigate to={`/poi/${poiId}/dashboard`} replace />;
  }

  function handlePoiChange(nextPoiId: string) {
    navigate(`/poi/${nextPoiId}/dashboard`);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <LogoMark size={30} />
            <h1>INFUNION Admin</h1>
          </div>
          <p className="sidebar-user">{user.firstName ?? user.email}</p>
        </div>

        <hr className="menu-divider" />

        {user.adminPois.length > 1 ? (
          <div className="poi-switcher">
            <p className="poi-switcher-caption">{t('layout.managing')}</p>
            <PickerRow
              icon={<PinIcon />}
              value={currentPoi?.name ?? ''}
              ariaLabel={`${t('layout.managing')}: ${currentPoi?.name ?? ''}`}
              onClick={() => setPoiPickerOpen(true)}
            />
            <PickerSheet
              open={poiPickerOpen}
              onClose={() => setPoiPickerOpen(false)}
              title={t('layout.choosePlace')}
              options={user.adminPois.map((poi) => ({ key: poi.id, label: poi.name }))}
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

        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {t(item.label)}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <hr className="menu-divider" />
          <LanguagePicker />
          <AppearancePicker />
          <button type="button" className="btn btn-destructive btn-block" onClick={logout}>
            {t('layout.signOut')}
          </button>
        </div>
      </aside>

      <main className="main">
        {visiting && (
          <p className="sa-viewing" role="status">
            <span>{sa('nav.viewing', { name: currentPoi?.name || sa('nav.thisCommunity') })}</span>
            <NavLink to={`/superadmin/communities/${poiId}`}>{sa('nav.backToSuperadmin')}</NavLink>
          </p>
        )}
        <Outlet context={{ poiId: poiId!, modules, refreshModules } satisfies DashboardContext} />
      </main>
    </div>
  );
}
