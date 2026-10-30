import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { getPoi } from '../api/pois';
import { updatePoiProfile } from '../api/poiSettings';
import type { Poi } from '../api/types';
import { Lockup } from '../components/LogoMark';

// Where the QR code sends a phone's camera — the public landing page's
// #join section (see the `landing/` site), which explains how to get the
// app and carries the POI's token through so it can be linked automatically
// once a real onboarding flow exists. The token is a query param (read by
// landing/assets/main.js) rather than part of the hash, since the hash is
// just the same-page anchor.
const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://infunion.app';

function joinUrlFor(qrCodeToken: string): string {
  return `${LANDING_URL}/?token=${encodeURIComponent(qrCodeToken)}#join`;
}

export function MyQrPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [poi, setPoi] = useState<Poi | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPoi(poiId).then((result) => {
      setPoi(result);
      // A place that never wrote its own text starts from the default one,
      // shown as real text the admin can keep or edit, not as a placeholder.
      setHeadline(result.qrFlyerHeadline || t('qr.defaultHeadline'));
      setSubtext(result.qrFlyerSubtext || t('qr.defaultSubtext'));
    });
  }, [poiId]);

  useEffect(() => {
    if (!poi) return;
    QRCode.toDataURL(joinUrlFor(poi.qrCodeToken), { width: 320, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [poi]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePoiProfile(poiId, {
        qrFlyerHeadline: headline.trim(),
        qrFlyerSubtext: subtext.trim(),
      });
      setPoi(updated);
    } catch {
      setError(t('qr.saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (!poi) return null;

  const displayHeadline = headline.trim() || t('qr.defaultHeadline');
  const displaySubtext = subtext.trim() || t('qr.defaultSubtext');

  return (
    <div>
      <h2>{t('qr.title')}</h2>
      <p className="muted">{t('qr.subtitle')}</p>

      <div className="card form">
        <label>
          {t('qr.flyerHeadlineLabel')}
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={t('qr.defaultHeadline')}
          />
        </label>
        <label>
          {t('qr.flyerSubtextLabel')}
          <textarea
            value={subtext}
            onChange={(e) => setSubtext(e.target.value)}
            placeholder={t('qr.defaultSubtext')}
          />
        </label>
        <div className="card-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            {t('qr.print')}
          </button>
          <button type="button" className="btn" disabled={saving} onClick={save}>
            {saving ? t('qr.saving') : t('qr.save')}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <p className="card-title" style={{ marginTop: 24 }}>
        {t('qr.previewTitle')}
      </p>
      <div className="qr-flyer">
        <div className="qr-flyer-inner">
          {poi.pictureUrl && <img src={poi.pictureUrl} alt={poi.name} className="qr-flyer-logo" />}
          <p className="qr-flyer-poi-name">{poi.name}</p>
          <h1 className="qr-flyer-headline">{displayHeadline}</h1>
          <p className="qr-flyer-subtext">{displaySubtext}</p>
          {qrDataUrl && <img src={qrDataUrl} alt={t('qr.scanHint')} className="qr-flyer-code" />}
          <p className="qr-flyer-hint">{t('qr.scanHint')}</p>
          <ol className="qr-flyer-steps">
            {(['qr.step1', 'qr.step2', 'qr.step3'] as const).map((key, index) => (
              <li key={key}>
                <span className="qr-flyer-step-number">{index + 1}</span>
                {t(key)}
              </li>
            ))}
          </ol>
          <div className="qr-flyer-footer">
            <span>{t('qr.getTheApp')}</span>
            <Lockup height={30} />
          </div>
        </div>
      </div>
    </div>
  );
}
