import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { updatePoiLanguage, updatePoiProfile } from '../api/poiSettings';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import type { Poi } from '../api/types';
import { LogoField } from './LogoField';

/**
 * Home page › Information (Seb, 10 Nov 2026: Settings is gone, what it
 * held sits where it shows): the community's name, description and logo,
 * as members see them in the app.
 */
export function CommunityInfoCard({ poi, onSaved }: { poi: Poi; onSaved: (poi: Poi) => void }) {
  const { t } = useI18n();
  const [description, setDescription] = useState(poi.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      onSaved(await updatePoiProfile(poi.id, { description: description.trim() }));
      setSaved(true);
    } catch {
      setError(t('poiInfo.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <p className="card-title">{t('poiInfo.title')}</p>
      <p className="muted" style={{ marginTop: 4 }}>
        {t('poiInfo.subtitle')}
      </p>
      <div className="form" style={{ marginTop: 4 }}>
        <label>
          {t('poiInfo.nameLabel')}
          <input value={poi.name} disabled />
        </label>
        <label>
          {t('poiInfo.descriptionLabel')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('poiInfo.descriptionPlaceholder')}
          />
        </label>
        <LogoField poi={poi} onSaved={onSaved} />
        <div className="card-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? t('poiInfo.saving') : t('poiInfo.save')}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {saved && !error && <p className="muted">{t('poiInfo.saveSuccess')}</p>}
      </div>
    </div>
  );
}

/**
 * Dashboard › Account: the language the community writes in (what posts
 * and notices are translated from).
 */
export function ContentLanguageCard({ poi, onSaved }: { poi: Poi; onSaved: (poi: Poi) => void }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<SupportedLanguage>(poi.language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      onSaved(await updatePoiLanguage(poi.id, selected));
      setSaved(true);
    } catch {
      setError(t('poiInfo.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="form">
        <label>
          <span className="card-title">{t('modules.contentLanguageTitle')}</span>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value as SupportedLanguage);
              setSaved(false);
            }}
          >
            {SUPPORTED_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
          <span className="field-hint">{t('modules.contentLanguageSubtitle')}</span>
        </label>
        <div className="card-actions">
          <button type="button" className="btn btn-primary" disabled={saving || selected === poi.language} onClick={save}>
            {saving ? t('poiInfo.saving') : t('poiInfo.save')}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {saved && !error && <p className="muted">{t('poiInfo.saveSuccess')}</p>}
      </div>
    </div>
  );
}
