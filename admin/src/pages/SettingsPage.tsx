import { Navigate, useSearchParams } from 'react-router-dom';

// Settings is gone (Seb, 10 Nov 2026): what shapes the community's app
// sits under Home page, the account under Dashboard. Old links (emails,
// bookmarks) land on the tab that took their place.
const MOVED: Record<string, string> = {
  info: '../home-page?tab=personalise',
  personalise: '../home-page?tab=personalise',
  place: '../home-page?tab=place',
  account: '../dashboard?tab=account',
};

export function SettingsPage() {
  const [params] = useSearchParams();
  return <Navigate to={MOVED[params.get('tab') ?? 'info'] ?? MOVED.info} replace />;
}
