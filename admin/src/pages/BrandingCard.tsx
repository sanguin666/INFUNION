import { useState, type ChangeEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../api/client';
import { removePoiLogo, updatePoiBranding, uploadPoiLogo } from '../api/poiSettings';
import type { Poi, PoiThemeName } from '../api/types';
import { PLACE_THEMES, placeInitials, placeTheme } from '../placeThemes';

/**
 * The community's look in the app, in Settings (Seb, 28 Oct 2026): its
 * logo, which replaces infunion's in the app's header inside the place,
 * and the colour its buttons and banner wear. Above the choices, the top
 * of the app as a member will see it, so the pick shows before it is
 * saved. The logo goes up as soon as it is picked; the colour waits for
 * Save.
 */
export function BrandingCard({ poi, onSaved }: { poi: Poi; onSaved: (poi: Poi) => void }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<PoiThemeName>(poi.theme ?? 'purple');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colours = placeTheme(theme);
  const dirty = theme !== (poi.theme ?? 'purple');

  async function pickLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onSaved(await uploadPoiLogo(poi.id, file));
    } catch {
      setError(t('branding.logoError'));
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setError(null);
    try {
      onSaved(await removePoiLogo(poi.id));
    } catch {
      setError(t('branding.saveError'));
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      onSaved(await updatePoiBranding(poi.id, theme));
      setSaved(true);
    } catch {
      setError(t('branding.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <p className="card-title">{t('branding.title')}</p>
      <p className="muted" style={{ marginTop: 4 }}>
        {t('branding.subtitle')}
      </p>

      {/* The app's header and a button, drawn here in the colours being
          picked: rows on the white card, not a box of their own. */}
      <p className="field-label">{t('branding.previewLabel')}</p>
      <div className="branding-preview" aria-hidden="true">
        {poi.logoUrl ? (
          <img className="branding-mark" src={`${API_BASE_URL}${poi.logoUrl}`} alt="" />
        ) : (
          <span className="branding-mark branding-initials" style={{ background: colours.strong }}>
            {placeInitials(poi.name)}
          </span>
        )}
        <span className="branding-name">
          <strong>{poi.name}</strong>
          <span className="muted">{poi.city ?? ''}</span>
        </span>
        <span className="branding-button" style={{ background: colours.primary }}>
          {t('branding.sampleButton')}
        </span>
      </div>

      <p className="field-label">{t('branding.logoLabel')}</p>
      <div className="campaign-photo-actions" style={{ marginTop: 0 }}>
        <label className="link-button">
          {uploading ? t('branding.logoUploading') : poi.logoUrl ? t('branding.logoChange') : t('branding.logoAdd')}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            disabled={uploading}
            onChange={pickLogo}
          />
        </label>
        {poi.logoUrl && (
          <button type="button" className="text-action text-action-destructive" onClick={removeLogo}>
            {t('branding.logoRemove')}
          </button>
        )}
      </div>
      <span className="field-hint">{t('branding.logoHint')}</span>

      <p className="field-label">{t('branding.themeLabel')}</p>
      <div className="chips" role="radiogroup" aria-label={t('branding.themeLabel')}>
        {PLACE_THEMES.map((option) => (
          <button
            key={option.name}
            type="button"
            role="radio"
            aria-checked={theme === option.name}
            className={`chip ${theme === option.name ? 'chip-selected' : ''}`}
            onClick={() => {
              setTheme(option.name);
              setSaved(false);
            }}
          >
            <span className="theme-swatch" style={{ background: option.primary }} aria-hidden="true" />
            {t(`branding.${option.name}`)}
          </button>
        ))}
      </div>
      <span className="field-hint">{t('branding.themeHint')}</span>

      <div className="card-actions">
        <button type="button" className="btn btn-primary" disabled={saving || !dirty} onClick={save}>
          {saving ? t('branding.saving') : t('branding.save')}
        </button>
        {saved && !dirty && <span className="muted">{t('branding.saved')}</span>}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
