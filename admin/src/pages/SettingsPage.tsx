import { useEffect, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { getActiveModules } from '../api/activeModules';
import { getPoi } from '../api/pois';
import { updatePoiLanguage, updatePoiProfile } from '../api/poiSettings';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import type { ActiveModule, Poi } from '../api/types';
import { LocationCard } from './LocationCard';
import { LogoField } from './LogoField';
import { PersonalisePanel } from './PersonalisePanel';
import { TabBar, TabPanel, useTab } from '../components/Tabs';

const TABS = ['info', 'personalise', 'place'] as const;

export function SettingsPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [tab, setTab] = useTab(TABS);
  const [modules, setModules] = useState<ActiveModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [poi, setPoi] = useState<Poi | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

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

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      let updated = await updatePoiProfile(poiId, {
        description: description.trim(),
      });
      if (selectedLanguage !== updated.language) updated = await updatePoiLanguage(poiId, selectedLanguage);
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
          { key: 'personalise', label: t('tabs.settingsPersonalise') },
          { key: 'place', label: t('tabs.settingsPlace') },
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
              <LogoField poi={poi} onSaved={setPoi} />
              <label>
                {t('modules.contentLanguageTitle')}
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)}
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
                <button type="button" className="btn btn-primary" disabled={savingProfile} onClick={saveProfile}>
                  {savingProfile ? t('poiInfo.saving') : t('poiInfo.save')}
                </button>
              </div>
              {profileError && <p className="error-text">{profileError}</p>}
              {profileSaved && !profileError && <p className="muted">{t('poiInfo.saveSuccess')}</p>}
            </div>
          </div>
        )}
      </TabPanel>

      <TabPanel idPrefix="settings" tabKey="personalise" current={tab}>
        {poi && modules !== null && <PersonalisePanel poi={poi} modules={modules} onSaved={setPoi} />}
      </TabPanel>

      <TabPanel idPrefix="settings" tabKey="place" current={tab}>
        {poi && <LocationCard key={poi.id} poi={poi} onSaved={setPoi} />}
      </TabPanel>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
