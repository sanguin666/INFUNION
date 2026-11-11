import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredItem } from '../storage/legacyKeys';
import { applyColorScheme, type ColorScheme } from './theme';

const STORAGE_KEY = 'infunion.appearance.v1';

/** What the member picked in More. "auto" follows the phone's setting. */
export type AppearancePreference = 'auto' | 'light' | 'dark';

const PREFERENCES: AppearancePreference[] = ['auto', 'light', 'dark'];

type AppearanceState = {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
  scheme: ColorScheme;
};

const AppearanceContext = createContext<AppearanceState | null>(null);

/**
 * Light or dark mode, stored on the phone like the language. This only
 * works out which scheme the member wants; App's routes apply it with
 * `applyColorScheme`, during render, so the screens below already read
 * the new colours — and only once somebody is signed in: the welcome and
 * sign-in screens always stay light (Seb, 28 Sep 2026).
 *
 * `forced` pins a scheme regardless of the phone or the choice, and
 * applies it here: the dashboard's phone preview is always light, like
 * the dashboard.
 */
export function AppearanceProvider({ children, forced }: { children: ReactNode; forced?: ColorScheme }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('auto');
  // Hold the first paint until the stored choice is read back, so
  // somebody who picked dark doesn't get a flash of light every launch.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getStoredItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && PREFERENCES.includes(stored as AppearancePreference)) {
          setPreferenceState(stored as AppearancePreference);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  function setPreference(next: AppearancePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Non-critical — the choice just won't survive an app restart.
    });
  }

  const scheme: ColorScheme =
    forced ?? (preference === 'auto' ? (system === 'dark' ? 'dark' : 'light') : preference);
  if (forced) applyColorScheme(forced);

  if (!loaded && !forced) return null;

  return (
    <AppearanceContext.Provider value={{ preference, setPreference, scheme }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceState {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
}
