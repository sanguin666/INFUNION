import { lazy, Suspense, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { geocode, updatePoiLocation, type GeocodeResult } from '../api/placesMap';
import { dotSvg } from '../placeKinds';
import type { Poi } from '../api/types';

// The map library is large: it loads with the card, not with the dashboard.
const PinMap = lazy(() => import('../components/PinMap'));

type Props = {
  poi: Poi;
  onSaved: (poi: Poi) => void;
};

/**
 * Settings > Address and map (Seb, 18 Oct 2026): the place's address and
 * its pin, which is what puts it on the app's map of
 * communities and in "near you". The address is looked up on
 * OpenStreetMap when the office presses Search, then the pin can be
 * dragged onto the entrance. The kind of place only shows here: it is
 * set when the community is created, and only the superadmin changes it.
 */
export function LocationCard({ poi, onSaved }: Props) {
  const { t, language } = useI18n();
  const type = poi.type;
  const [address, setAddress] = useState(poi.address ?? '');
  const [city, setCity] = useState(poi.city ?? '');
  const [postalCode, setPostalCode] = useState(poi.postalCode ?? '');
  const [latitude, setLatitude] = useState<number | null>(poi.latitude);
  const [longitude, setLongitude] = useState<number | null>(poi.longitude);
  const [mapVisible, setMapVisible] = useState(poi.mapVisible);

  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const query = [address, postalCode, city].map((part) => part.trim()).filter(Boolean).join(', ');

  async function search() {
    if (!query) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    try {
      const found = await geocode(query, language);
      setResults(found);
      // One clear answer: take it straight away, the map shows where.
      if (found.length === 1) pick(found[0]);
    } catch {
      setSearchError(t('location.searchError'));
    } finally {
      setSearching(false);
    }
  }

  function pick(result: GeocodeResult) {
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    if (result.address) setAddress(result.address);
    if (result.city) setCity(result.city);
    if (result.postalCode) setPostalCode(result.postalCode);
    setResults(null);
    setSaved(false);
  }

  function move(lat: number, lng: number) {
    setLatitude(Math.round(lat * 1e6) / 1e6);
    setLongitude(Math.round(lng * 1e6) / 1e6);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updatePoiLocation(poi.id, {
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        latitude,
        longitude,
        mapVisible,
      });
      onSaved(updated);
      setSaved(true);
    } catch {
      setSaveError(t('location.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <p className="card-title">{t('location.title')}</p>
      <p className="muted" style={{ marginTop: 4 }}>
        {t('location.subtitle')}
      </p>
      <div className="form" style={{ marginTop: 4 }}>
        <div className="form-row">
          {t('location.typeLabel')}
          <span className="form-row-value chip-kind">
            <span dangerouslySetInnerHTML={{ __html: dotSvg(type, 22) }} style={{ display: 'flex' }} />
            {t(`location.kind_${type}`)}
          </span>
          <span style={{ fontSize: 14 }}>{t('location.typeLocked')}</span>
        </div>
        <label>
          {t('location.addressLabel')}
          <span className="input-with-action">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setSaved(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder={t('location.addressPlaceholder')}
            />
            <button type="button" className="btn" disabled={!query || searching} onClick={() => void search()}>
              {searching ? t('location.searching') : t('location.search')}
            </button>
          </span>
          {results && results.length === 0 && <span className="muted">{t('location.noResults')}</span>}
          {results && results.length > 1 && (
            <ul className="geocode-results" aria-label={t('location.resultsLabel')}>
              {results.map((result) => (
                <li key={`${result.latitude},${result.longitude}`}>
                  <button type="button" onClick={() => pick(result)}>
                    ↳ {result.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchError && <span className="error-text">{searchError}</span>}
        </label>
        <label>
          {t('location.postalCodeLabel')}
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </label>
        <label>
          {t('location.cityLabel')}
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <span style={{ flex: 1 }}>
            {t('location.visibleLabel')}
            <span className="form-row-value" style={{ display: 'block', fontSize: 16 }}>
              {t('location.visibleHelp')}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={mapVisible}
            onChange={(e) => {
              setMapVisible(e.target.checked);
              setSaved(false);
            }}
            aria-label={t('location.visibleLabel')}
          />
        </div>
        <Suspense fallback={<div className="pin-map" />}>
          <PinMap latitude={latitude} longitude={longitude} type={type} onMove={move} label={t('location.mapLabel')} />
        </Suspense>
      </div>
      <p className="muted" style={{ marginTop: 12 }}>
        {latitude === null ? t('location.noPin') : t('location.mapHelp')}
      </p>
      <div className="card-actions">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? t('location.saving') : t('location.save')}
        </button>
        {latitude !== null && (
          <button
            type="button"
            className="text-action"
            onClick={() => {
              setLatitude(null);
              setLongitude(null);
              setSaved(false);
            }}
          >
            {t('location.removePin')}
          </button>
        )}
      </div>
      {saveError && <p className="error-text">{saveError}</p>}
      {saved && !saveError && <p className="muted">{t('location.saved')}</p>}
    </div>
  );
}
