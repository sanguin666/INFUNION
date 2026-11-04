import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPPORTED_LANGUAGES, translations, type SupportedLanguage, type Translations } from './translations';

const STORAGE_KEY = 'ansae-language';
const AUTO_TRANSLATE_KEY = 'infunion-auto-translate';

type I18nState = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  // More › Language › Translate automatically (Seb, 4 Nov 2026): what is
  // written in another language opens already translated.
  autoTranslate: boolean;
  setAutoTranslate: (on: boolean) => void;
  t: <K extends keyof Translations>(
    key: `${K}.${Extract<keyof Translations[K], string>}`,
    params?: Record<string, string | number>,
  ) => string;
};

const I18nContext = createContext<I18nState | null>(null);

function resolve(key: string, dict: Translations): string | undefined {
  const [section, field] = key.split('.') as [keyof Translations, string];
  const sectionDict = dict[section] as Record<string, string> | undefined;
  return sectionDict?.[field];
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    text,
  );
}

/**
 * Device-local language preference — there's no congregant login yet to
 * persist this against on the backend (unlike the admin dashboard, whose
 * language is tied to a real account). See Poi.language and User.language
 * on the backend for the data-model side of this.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [autoTranslate, setAutoTranslateState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
          setLanguageState(stored as SupportedLanguage);
        }
      })
      .catch(() => {
        // Fall back to the default language if storage isn't available.
      });
    AsyncStorage.getItem(AUTO_TRANSLATE_KEY)
      .then((stored) => setAutoTranslateState(stored === 'on'))
      .catch(() => undefined);
  }, []);

  function setAutoTranslate(on: boolean) {
    setAutoTranslateState(on);
    AsyncStorage.setItem(AUTO_TRANSLATE_KEY, on ? 'on' : 'off').catch(() => undefined);
  }

  function setLanguage(next: SupportedLanguage) {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Non-critical — the choice just won't survive an app restart.
    });
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const raw = resolve(key, translations[language]) ?? resolve(key, translations.en) ?? key;
    return interpolate(raw, params);
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, autoTranslate, setAutoTranslate, t: t as I18nState['t'] }}>
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
