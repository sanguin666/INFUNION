import { useEffect, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { getActiveModules } from '../api/activeModules';
import { getPoi } from '../api/pois';
import { updatePoiLanguage, updatePoiProfile } from '../api/poiSettings';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import type { ActiveModule, Poi } from '../api/types';
import { MenuOrderCard } from './MenuOrderCard';
import { LocationCard } from './LocationCard';
import { BrandingCard } from './BrandingCard';
import { TabBar, TabPanel, useTab } from '../components/Tabs';

const TABS = ['info', 'look', 'place', 'menu'] as const;

export function SettingsPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [tab, setTab] = useTab(TABS);
  const [modules, setModules] = useState<ActiveModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [poi, setPoi] = useState<Poi | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  function load() {
    getActiveModules(poiId)
      .then(setModules)
      .catch(() => setError(t('modules.loadError')));
    getPoi(poiId).then((result) => {
      setPoi(result);
      setSelectedLanguage(result.language);
      setDescription(result.description ?? '');
    });
  }

  useEffect(load, [poiId]);

  async function saveLanguage() {
    setSavingLanguage(true);
    setLanguageError(null);
    try {
      const updated = await updatePoiLanguage(poiId, selectedLanguage);
      setPoi(updated);
    } catch {
      setLanguageError(t('modules.languageSaveError'));
    } finally {
      setSavingLanguage(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const updated = await updatePoiProfile(poiId, {
        description: description.trim(),
      });
      setPoi(updated);
      setProfileSaved(true);
    } catch {
      setProfileError(t('poiInfo.saveError'));
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div>
      <h2>{t('modules.title')}</h2>
      <p className="muted">{t('modules.subtitle')}</p>

      <TabBar
        idPrefix="settings"
        label={t('tabs.label')}
        current={tab}
        onChange={setTab}
        tabs={[
          { key: 'info', label: t('tabs.settingsInfo') },
          { key: 'look', label: t('tabs.settingsLook') },
          { key: 'place', label: t('tabs.settingsPlace') },
          { key: 'menu', label: t('tabs.settingsMenu') },
        ]}
      />

      <TabPanel idPrefix="settings" tabKey="info" current={tab}>

        {poi && (
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
              <div className="card-actions">
                <button type="button" className="btn btn-primary" disabled={savingProfile} onClick={saveProfile}>
                  {savingProfile ? t('poiInfo.saving') : t('poiInfo.save')}
                </button>
              </div>
              {profileError && <p className="error-text">{profileError}</p>}
              {profileSaved && !profileError && <p className="muted">{t('poiInfo.saveSuccess')}</p>}
            </div>
          </div>
        )}

        {poi && (
          <div className="card">
            <p className="card-title">{t('modules.contentLanguageTitle')}</p>
            <p className="muted" style={{ marginTop: 4 }}>
              {t('modules.contentLanguageSubtitle')}
            </p>
            <div className="card-actions">
              <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)}>
                {SUPPORTED_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_NAMES[code]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingLanguage || selectedLanguage === poi.language}
                onClick={saveLanguage}
              >
                {savingLanguage ? t('modules.savingLanguage') : t('modules.saveLanguage')}
              </button>
            </div>
            {languageError && <p className="error-text">{languageError}</p>}
          </div>
        )}
      </TabPanel>

      <TabPanel idPrefix="settings" tabKey="look" current={tab}>
        {poi && <BrandingCard key={`branding-${poi.id}`} poi={poi} onSaved={setPoi} />}
      </TabPanel>

      <TabPanel idPrefix="settings" tabKey="place" current={tab}>
        {poi && <LocationCard key={poi.id} poi={poi} onSaved={setPoi} />}
      </TabPanel>

      <TabPanel idPrefix="settings" tabKey="menu" current={tab}>

        {poi && modules !== null && (
          <MenuOrderCard poi={poi} modules={modules} onSaved={setPoi} />
        )}
      </TabPanel>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
