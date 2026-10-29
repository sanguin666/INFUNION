import { useState, type ChangeEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../api/client';
import { removePoiLogo, uploadPoiLogo } from '../api/poiSettings';
import type { Poi } from '../api/types';
import { LogoMark } from '../components/LogoMark';

/**
 * The community's logo, a row of the Information card in Settings (Seb,
 * 29 Oct 2026: the logo says who you are, so it sits with the name). It
 * replaces infunion's in the app's header inside the place, and goes up
 * as soon as it is picked.
 */
export function LogoField({ poi, onSaved }: { poi: Poi; onSaved: (poi: Poi) => void }) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="form-row">
      <span>{t('branding.logoLabel')}</span>
      <div className="logo-field">
        <PlaceMark poi={poi} />
        <div style={{ minWidth: 0 }}>
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
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

/** The place's logo in its circle, or infunion's rings when it has none. */
export function PlaceMark({ poi, size = 44 }: { poi: Poi; size?: number }) {
  return poi.logoUrl ? (
    <img
      className="branding-mark"
      style={{ width: size, height: size }}
      src={`${API_BASE_URL}${poi.logoUrl}`}
      alt=""
    />
  ) : (
    <span className="branding-mark branding-infunion" style={{ width: size, height: size }} aria-hidden="true">
      <LogoMark size={size - 4} />
    </span>
  );
}
