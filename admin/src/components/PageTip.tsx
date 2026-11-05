import { useI18n } from '../i18n/I18nContext';
import type { Translations } from '../i18n/translations';

type TipKey = Extract<keyof Translations['tour'], `tip_${string}`>;

// The menu's pages that get a tip the first time they are opened
// (Seb, 5 Nov 2026), by their path in the menu.
export const PAGE_TIPS: Record<string, { tip: TipKey; title: `layout.${keyof Translations['layout']}` }> = {
  'home-page': { tip: 'tip_homePage', title: 'layout.navHomePage' },
  members: { tip: 'tip_members', title: 'layout.navMembers' },
  requests: { tip: 'tip_requests', title: 'layout.navRequests' },
  events: { tip: 'tip_events', title: 'layout.navEvents' },
  announcements: { tip: 'tip_announcements', title: 'layout.navAnnouncements' },
  donations: { tip: 'tip_donations', title: 'layout.navDonations' },
  'mass-intentions': { tip: 'tip_massIntentions', title: 'layout.navMassIntentions' },
  'prayer-requests': { tip: 'tip_prayerRequests', title: 'layout.navPrayerRequests' },
  readings: { tip: 'tip_readings', title: 'layout.navReadings' },
  livestreams: { tip: 'tip_livestreams', title: 'layout.navLivestreams' },
  community: { tip: 'tip_community', title: 'layout.navCommunity' },
  settings: { tip: 'tip_settings', title: 'layout.navSettings' },
  modules: { tip: 'tip_modules', title: 'layout.navModules' },
  'my-qr': { tip: 'tip_myQr', title: 'layout.navMyQr' },
};

/** A page's tip, above its content until "Got it". */
export function PageTip({ page, onDismiss }: { page: string; onDismiss: () => void }) {
  const { t } = useI18n();
  const tip = PAGE_TIPS[page];
  if (!tip) return null;
  return (
    <aside className="page-tip" aria-label={t('tour.tipLabel')}>
      <span className="page-tip-icon" aria-hidden="true">
        i
      </span>
      <div className="page-tip-body">
        <p className="page-tip-title">{t(tip.title)}</p>
        <p className="page-tip-text">{t(`tour.${tip.tip}`)}</p>
      </div>
      <button type="button" className="page-tip-close" onClick={onDismiss}>
        {t('tour.gotIt')} <span aria-hidden="true">✕</span>
      </button>
    </aside>
  );
}
