import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import { GlobeIcon, PickerRow, PickerSheet } from './PickerSheet';

/**
 * The app's language picker: one row carrying the language it is
 * currently set to, rather than six abbreviations side by side. The
 * list only appears once somebody asks for it.
 */
export function LanguagePicker({ compact = false }: { compact?: boolean } = {}) {
  const { t, language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PickerRow
        icon={<GlobeIcon />}
        label={compact ? undefined : t('layout.language')}
        compact={compact}
        value={LANGUAGE_NAMES[language]}
        ariaLabel={`${t('layout.language')}: ${LANGUAGE_NAMES[language]}`}
        onClick={() => setOpen(true)}
      />
      <PickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('layout.chooseLanguage')}
        options={SUPPORTED_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code], lang: code }))}
        selectedKey={language}
        onChoose={(code) => setLanguage(code as SupportedLanguage)}
        closeLabel={t('layout.close')}
      />
    </>
  );
}
