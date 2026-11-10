import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { translatorFor, useI18n } from '../i18n/I18nContext';
import { getCampaigns } from '../api/donations';
import { API_BASE_URL } from '../api/client';
import { getPoi } from '../api/pois';
import type { Campaign, Poi } from '../api/types';
import { Lockup } from '../components/LogoMark';

/**
 * The community's own pay link and its QR code (Seb, 10 Nov 2026):
 * printed on a poster, shown on a screen or sent on WhatsApp, it opens
 * a page where anyone pays by card, Apple Pay or Google Pay, with no app
 * and no account. Served by the API at /m/pay/:poiId.
 */
export function PayLinkSection({ poiId }: { poiId: string }) {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [amount, setAmount] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [poi, setPoi] = useState<Poi | null>(null);
  const communityName = poi?.name ?? '';

  useEffect(() => {
    getPoi(poiId)
      .then(setPoi)
      .catch(() => setPoi(null));
  }, [poiId]);

  useEffect(() => {
    getCampaigns(poiId)
      .then((list) => setCampaigns(list.filter((c) => c.active)))
      .catch(() => setCampaigns([]));
  }, [poiId]);

  const params = new URLSearchParams();
  if (campaignId) params.set('campaign', campaignId);
  const cleanAmount = Number(amount.replace(',', '.'));
  if (amount.trim() && Number.isFinite(cleanAmount) && cleanAmount >= 1) params.set('amount', String(cleanAmount));
  const query = params.toString();
  const link = `${API_BASE_URL}/m/pay/${poiId}${query ? `?${query}` : ''}`;

  useEffect(() => {
    QRCode.toDataURL(link, { width: 640, margin: 2, color: { dark: '#1f1b2e' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (e.g. not https): the link is selectable anyway.
    }
  }

  const fileName = `${communityName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'infunion'}-pay-qr.png`;

  return (
    <div className="card paylink">
      <p className="muted" style={{ marginTop: 0 }}>{t('payLink.intro')}</p>
      <div className="paylink-grid">
        <div className="form paylink-fields">
          <label>
            {t('payLink.forLabel')}
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">{t('payLink.general')}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('payLink.amountLabel')}
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
            />
            <span className="card-meta" style={{ fontWeight: 400 }}>{t('payLink.amountHint')}</span>
          </label>
          <div className="form-row">
            {t('payLink.linkLabel')}
            <span className="form-row-value paylink-url">{link}</span>
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-primary" onClick={copy}>
              {copied ? t('payLink.copied') : t('payLink.copy')}
            </button>
            <a className="btn" href={link} target="_blank" rel="noreferrer">
              {t('payLink.open')}
            </a>
          </div>
        </div>
        <div className="paylink-qr">
          {qr && <img src={qr} alt={`${t('payLink.qrAlt')} ${communityName}`} width={220} height={220} />}
          {qr && (
            <a className="btn" href={qr} download={fileName}>
              {t('payLink.download')}
            </a>
          )}
          {qr && (
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              {t('payLink.print')}
            </button>
          )}
        </div>
      </div>
      {poi && qr && <PayFlyer poi={poi} qr={qr} campaign={campaigns.find((c) => c.id === campaignId) ?? null} amount={params.get('amount')} />}
    </div>
  );
}

/**
 * The printed poster, like the "join" one in My QR code (same .qr-flyer
 * styles, so printing keeps only the poster): in the community's language,
 * since it is for the people who will scan it.
 */
function PayFlyer({ poi, qr, campaign, amount }: { poi: Poi; qr: string; campaign: Campaign | null; amount: string | null }) {
  const { t } = useI18n();
  const flyerT = translatorFor(poi.language);
  return (
    <>
      <p className="card-title" style={{ marginTop: 24 }}>
        {t('payLink.previewTitle')}
      </p>
      <div className="qr-flyer">
        <div className="qr-flyer-inner">
          {poi.pictureUrl && <img src={poi.pictureUrl} alt={poi.name} className="qr-flyer-logo" />}
          <p className="qr-flyer-poi-name">{poi.name}</p>
          <h1 className="qr-flyer-headline">
            {campaign ? campaign.title : flyerT('payLink.flyerHeadline', { name: poi.name })}
          </h1>
          {amount && <p className="qr-flyer-subtext">{flyerT('payLink.flyerAmount', { amount: amount.replace('.', ',') })}</p>}
          <img src={qr} alt={flyerT('payLink.qrAlt')} className="qr-flyer-code" />
          <p className="qr-flyer-hint">{flyerT('payLink.flyerScan')}</p>
          <p className="qr-flyer-subtext">{flyerT('payLink.flyerMethods')}</p>
          <div className="qr-flyer-footer">
            <span>{flyerT('payLink.madeWith')}</span>
            <Lockup height={26} />
          </div>
        </div>
      </div>
    </>
  );
}
