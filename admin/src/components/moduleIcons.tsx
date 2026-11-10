import type { ModuleType } from '../api/types';

// One line drawing per module, shared by the admin menu and the Plans
// and modules page so a module looks the same in both places.
export const MODULE_ICON: Record<ModuleType, string> = {
  events: 'M4 7h16v13H4zM4 7V5h16v2M8 3v4M16 3v4M8 12h3',
  donations: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  announcements: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  requests: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  messages: 'M4 5h16v11H9l-5 4z',
  community: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M21 19a5 5 0 0 0-4-5',
  livestreams: 'M3 7h12v10H3zM15 11l6-3v8l-6-3',
  prayer_requests: 'M12 3v6M9 6h6M6 21l3-9h6l3 9',
  daily_readings: 'M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1zM12 6v14',
  mass_intentions: 'M12 3v4M10 5h4M7 21V11l5-3 5 3v10M10 21v-5h4v5',
};

// The menu's own pages.
export const PAGE_ICON = {
  dashboard: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  homePage: 'M7 3h10v18H7zM11 18h2',
  members: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  plan: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  website: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6z',
};

export function LineIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
