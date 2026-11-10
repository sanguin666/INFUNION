import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ContrastIcon, PickerRow, PickerSheet } from './PickerSheet';

const STORAGE_KEY = 'ansae-admin-appearance';

type Preference = 'auto' | 'light' | 'dark';
const PREFERENCES: Preference[] = ['auto', 'light', 'dark'];

function readPreference(): Preference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && PREFERENCES.includes(stored as Preference)) return stored as Preference;
  } catch {
    // Storage blocked: fall back to following the computer.
  }
  return 'auto';
}

function systemIsDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * Light or dark mode for the dashboard, the app's "Appearance" row: one
 * row saying what it is set to, the choice in a sheet. "Automatic"
 * follows the computer's setting. It lives in the signed-in layout only,
 * and takes the dark theme off <html> when it goes, so the sign-in page
 * is always light (Seb, 28 Sep 2026: dark mode only after login).
 */
export function AppearancePicker({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useI18n();
  const [preference, setPreference] = useState<Preference>(readPreference);
  const [systemDark, setSystemDark] = useState(systemIsDark);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const dark = preference === 'dark' || (preference === 'auto' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [dark]);

  function choose(next: Preference) {
    setPreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-critical — the choice just won't survive a reload.
    }
  }

  const labels: Record<Preference, string> = {
    auto: t('layout.appearanceAuto'),
    light: t('layout.appearanceLight'),
    dark: t('layout.appearanceDark'),
  };

  return (
    <>
      <PickerRow
        icon={<ContrastIcon />}
        label={compact ? undefined : t('layout.appearance')}
        compact={compact}
        value={labels[preference]}
        ariaLabel={`${t('layout.appearance')}: ${labels[preference]}`}
        onClick={() => setOpen(true)}
      />
      <PickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('layout.appearance')}
        options={PREFERENCES.map((key) => ({ key, label: labels[key] }))}
        selectedKey={preference}
        onChoose={(key) => choose(key as Preference)}
        closeLabel={t('layout.close')}
      />
    </>
  );
}
