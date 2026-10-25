import { useMemo } from 'react';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale, type Translations } from '../i18n/translations';
import { SA_TRANSLATIONS } from './translations';

// Module types to their names in the dashboard's own translations.
const MODULE_KEYS: Record<string, keyof Translations['moduleNames']> = {
  events: 'events',
  requests: 'requests',
  donations: 'donations',
  mass_intentions: 'massIntentions',
  daily_readings: 'readings',
  announcements: 'announcements',
  livestreams: 'livestream',
  prayer_requests: 'prayerRequests',
  community: 'community',
  messages: 'messages',
};

type Params = Record<string, string | number>;

function lookup(table: unknown, key: string): string | undefined {
  // Journal keys contain dots themselves ('admin.login'), so only the
  // first dot separates the section from the entry.
  const dot = key.indexOf('.');
  const section = (table as Record<string, Record<string, string>>)[key.slice(0, dot)];
  return section?.[key.slice(dot + 1)];
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** The superadmin section's words and number/date formats, in the dashboard's language. */
export function useSa() {
  const { t, language } = useI18n();

  return useMemo(() => {
    const locale = intlLocale(language);
    const table = SA_TRANSLATIONS[language] ?? SA_TRANSLATIONS.en;
    const s = (key: string, params?: Params): string =>
      fill(lookup(table, key) ?? lookup(SA_TRANSLATIONS.en, key) ?? key, params);

    const euros = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
    const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const dayTime = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const month = new Intl.DateTimeFormat(locale, { month: 'short' });

    const date = (iso: string | null | undefined) => (iso ? day.format(new Date(iso)) : '—');
    const dateTime = (iso: string | null | undefined) => (iso ? dayTime.format(new Date(iso)) : '—');

    return {
      s,
      language,
      locale,
      money: (value: number) => euros.format(value),
      date,
      dateTime,
      monthShort: (yyyyMm: string) => month.format(new Date(`${yyyyMm}-01T12:00:00Z`)).replace('.', ''),
      ago: (iso: string | null | undefined) => {
        if (!iso) return s('common.never');
        const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (minutes < 2) return s('common.justNow');
        if (minutes < 60) return s('common.minutesAgo', { n: minutes });
        const hours = Math.round(minutes / 60);
        if (hours < 24) return s('common.hoursAgo', { n: hours });
        const days = Math.round(hours / 24);
        if (days === 1) return s('common.yesterday');
        if (days < 45) return s('common.daysAgo', { n: days });
        return date(iso);
      },
      moduleLabel: (type: string) => (MODULE_KEYS[type] ? t(`moduleNames.${MODULE_KEYS[type]}`) : type),
      /** A failed call, in words: known server codes are translated. */
      error: (err: unknown) => {
        if (err instanceof ApiError && err.status === 429) return s('errors.too_many');
        const message = err instanceof Error ? err.message : '';
        if (!message) return s('errors.generic');
        return lookup(table, `errors.${message}`) ?? lookup(SA_TRANSLATIONS.en, `errors.${message}`) ?? message;
      },
    };
  }, [language, t]);
}

export type Sa = ReturnType<typeof useSa>;
