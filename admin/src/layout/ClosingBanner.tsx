import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CLOSURE_CHANGED, getClosure, type ClosureStatus } from '../api/closure';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * On every page of a place whose account is closing: the date, who asked,
 * and the way back. Nothing while the place is open.
 */
export function ClosingBanner({ poiId }: { poiId: string }) {
  const { t, language } = useI18n();
  const [status, setStatus] = useState<ClosureStatus | null>(null);

  useEffect(() => {
    const load = () =>
      getClosure(poiId)
        .then(setStatus)
        .catch(() => setStatus(null));
    load();
    window.addEventListener(CLOSURE_CHANGED, load);
    return () => window.removeEventListener(CLOSURE_CHANGED, load);
  }, [poiId]);

  if (status?.state !== 'closing' || !status.closesAt) return null;
  const date = new Date(status.closesAt).toLocaleDateString(intlLocale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const days = Math.max(0, Math.ceil((new Date(status.closesAt).getTime() - Date.now()) / DAY_MS));
  const name = status.requestedBy ?? '—';
  return (
    <div className="closing-banner" role="status">
      <span>{days > 1 ? t('closure.bannerDays', { date, days, name }) : t('closure.bannerLastDay', { date, name })}</span>
      <NavLink className="btn btn-primary" to={`/poi/${poiId}/settings?tab=account`}>
        {t('closure.keep')}
      </NavLink>
    </div>
  );
}
