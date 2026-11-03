import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { getToken } from '../api/client';
import { updateMyLanguage } from '../api/auth';
import { SUPPORTED_LANGUAGES, translations, type SupportedLanguage, type Translations } from './translations';

const STORAGE_KEY = 'ansae-admin-language';

type I18nState = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage, options?: { persist?: boolean }) => void;
  // Has this browser ever had an explicit choice (picked here, pre- or
  // post-login)? LanguageSync uses this to decide whether the account's
  // saved language should adopt into the UI, or the UI's local choice
  // should instead be pushed up to the account — an explicit choice must
  // never be silently discarded.
  hasLocalPreference: () => boolean;
  t: <K extends keyof Translations>(
    key: `${K}.${Extract<keyof Translations[K], string>}`,
    params?: Record<string, string | number>,
  ) => string;
};

const I18nContext = createContext<I18nState | null>(null);

function readStoredLanguage(): SupportedLanguage | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // localStorage unavailable — treat as no preference yet.
  }
  return null;
}

function resolve(key: string, dict: Translations): string | undefined {
  const [section, field] = key.split('.') as [keyof Translations, string];
  const sectionDict = dict[section] as Record<string, string> | undefined;
  return sectionDict?.[field];
}

function translateIn(
  language: SupportedLanguage,
  key: string,
  params?: Record<string, string | number>,
): string {
  const raw = resolve(key, translations[language]) ?? resolve(key, translations.en) ?? key;
  if (!params) return raw;
  return Object.entries(params).reduce(
    (result, [paramKey, value]) => result.replaceAll(`{{${paramKey}}}`, String(value)),
    raw,
  );
}

/**
 * A translator for a fixed language, independent of the admin's UI
 * language — for text members will read, such as the printed QR flyer,
 * which follows the community's own language setting.
 */
export function translatorFor(language: SupportedLanguage): I18nState['t'] {
  return ((key: string, params?: Record<string, string | number>) =>
    translateIn(language, key, params)) as I18nState['t'];
}

/**
 * Local preference by default (so the login screen, before there's a
 * session, still has a language) — once signed in, this syncs with the
 * account's own saved language (see LanguageSync in App.tsx) and any
 * change the admin makes here is written back to their account too.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const initialStored = readStoredLanguage();
  const [language, setLanguageState] = useState<SupportedLanguage>(initialStored ?? 'en');
  const hasLocalPreferenceRef = useRef(initialStored !== null);

  function setLanguage(next: SupportedLanguage, options?: { persist?: boolean }) {
    setLanguageState(next);
    hasLocalPreferenceRef.current = true;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-critical — the choice just won't survive a reload.
    }
    if (options?.persist !== false && getToken()) {
      updateMyLanguage(next).catch(() => {
        // Non-critical — the UI already reflects the choice locally.
      });
    }
  }

  function t(key: string, params?: Record<string, string | number>): string {
    return translateIn(language, key, params);
  }

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        hasLocalPreference: () => hasLocalPreferenceRef.current,
        t: t as I18nState['t'],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nState {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
