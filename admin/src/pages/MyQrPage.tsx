import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { usePoiId } from '../layout/usePoiId';
import { translatorFor, useI18n } from '../i18n/I18nContext';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';
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

// A saved text that is just one language's default (e.g. the English one,
// saved before the flyer followed the community's language) counts as
// "not customised", so the flyer falls back to the community-language default.
function customText(saved: string | null, key: 'qr.defaultHeadline' | 'qr.defaultSubtext'): string {
  const text = saved?.trim() ?? '';
  return SUPPORTED_LANGUAGES.some((language) => translatorFor(language)(key) === text) ? '' : text;
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
      // The flyer is for members, so it is in the community's language,
      // not the admin's UI language.
      const flyerT = translatorFor(result.language);
      setHeadline(customText(result.qrFlyerHeadline, 'qr.defaultHeadline') || flyerT('qr.defaultHeadline'));
      setSubtext(customText(result.qrFlyerSubtext, 'qr.defaultSubtext') || flyerT('qr.defaultSubtext'));
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
        // An unchanged default is stored as empty, so the flyer keeps
        // following the community's language if that setting changes.
        qrFlyerHeadline: customText(headline, 'qr.defaultHeadline'),
        qrFlyerSubtext: customText(subtext, 'qr.defaultSubtext'),
      });
      setPoi(updated);
    } catch {
      setError(t('qr.saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (!poi) return null;

  // Everything printed on the flyer follows the community's language.
  const flyerT = translatorFor(poi.language);

  const displayHeadline = headline.trim() || flyerT('qr.defaultHeadline');
  const displaySubtext = subtext.trim() || flyerT('qr.defaultSubtext');

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
            placeholder={flyerT('qr.defaultHeadline')}
          />
        </label>
        <label>
          {t('qr.flyerSubtextLabel')}
          <textarea
            value={subtext}
            onChange={(e) => setSubtext(e.target.value)}
            placeholder={flyerT('qr.defaultSubtext')}
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
          {qrDataUrl && <img src={qrDataUrl} alt={flyerT('qr.scanHint')} className="qr-flyer-code" />}
          <p className="qr-flyer-hint">{flyerT('qr.scanHint')}</p>
          <ol className="qr-flyer-steps">
            {(['qr.step1', 'qr.step2', 'qr.step3'] as const).map((key, index) => (
              <li key={key}>
                <span className="qr-flyer-step-number">{index + 1}</span>
                {flyerT(key)}
              </li>
            ))}
          </ol>
          <div className="qr-flyer-footer">
            <span>{flyerT('qr.getTheApp')}</span>
            <Lockup height={26} />
          </div>
        </div>
      </div>
    </div>
  );
}
