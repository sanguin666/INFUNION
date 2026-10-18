import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './layout/DashboardLayout';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { EventsPage } from './pages/EventsPage';
import { LivestreamsPage } from './pages/LivestreamsPage';
import { PrayerRequestsPage } from './pages/PrayerRequestsPage';
import { CommunityPage } from './pages/CommunityPage';
import { SettingsPage } from './pages/SettingsPage';
import { ModulesPage } from './pages/ModulesPage';
import { MyQrPage } from './pages/MyQrPage';
import { PoiHomePage } from './pages/PoiHomePage';
import { DonationsPage } from './pages/DonationsPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequestDetailPage, RequestsPage } from './pages/RequestsPage';
import { MassIntentionsPage } from './pages/MassIntentionsPage';
import { ReadingsPage } from './pages/ReadingsPage';
import { SuperadminLayout } from './superadmin/SuperadminLayout';
import { SuperadminOverviewPage } from './superadmin/OverviewPage';
import { SuperadminCommunitiesPage } from './superadmin/CommunitiesPage';
import { SuperadminCommunityPage } from './superadmin/CommunityPage';
import { SuperadminAccountsPage } from './superadmin/AccountsPage';
import { SuperadminHealthPage } from './superadmin/HealthPage';
import { SuperadminJournalPage } from './superadmin/JournalPage';

// Reconciles the UI's language with the account's saved one on login.
// An explicit choice never gets silently discarded either direction: if
// this browser has no local preference yet, adopt the account's saved
// language; if it does (e.g. picked on the login screen, before there
// was a session to save it against), push that choice up to the account
// instead.
function LanguageSync() {
  const { user } = useAuth();
  const { language, setLanguage, hasLocalPreference } = useI18n();
  useEffect(() => {
    if (!user?.language) return;
    if (hasLocalPreference()) {
      if (user.language !== language) setLanguage(language, { persist: true });
    } else {
      setLanguage(user.language, { persist: false });
    }
  }, [user?.language]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div style={{ padding: 32 }}>{t('common.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user) return null;
  const firstPoi = user.adminPois[0];
  if (!firstPoi && user.isSuperadmin) return <Navigate to="/superadmin" replace />;
  if (!firstPoi) {
    return (
      <div style={{ padding: 32 }}>
        <p>{t('layout.noAdminPois')}</p>
      </div>
    );
  }
  return <Navigate to={`/poi/${firstPoi.id}/dashboard`} replace />;
}

function PoiIndexRedirect() {
  const { poiId } = useParams<{ poiId: string }>();
  return <Navigate to={`/poi/${poiId}/dashboard`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/poi/:poiId"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<PoiIndexRedirect />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="donations" element={<DonationsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/:requestId" element={<RequestDetailPage />} />
        <Route path="mass-intentions" element={<MassIntentionsPage />} />
        <Route path="readings" element={<ReadingsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="livestreams" element={<LivestreamsPage />} />
        <Route path="prayer-requests" element={<PrayerRequestsPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="my-qr" element={<MyQrPage />} />
        <Route path="home-page" element={<PoiHomePage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="/superadmin"
        element={
          <RequireAuth>
            <SuperadminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<SuperadminOverviewPage />} />
        <Route path="communities" element={<SuperadminCommunitiesPage />} />
        <Route path="communities/:poiId" element={<SuperadminCommunityPage />} />
        <Route path="accounts" element={<SuperadminAccountsPage />} />
        <Route path="health" element={<SuperadminHealthPage />} />
        <Route path="journal" element={<SuperadminJournalPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <LanguageSync />
        <AppRoutes />
      </AuthProvider>
    </I18nProvider>
  );
}
