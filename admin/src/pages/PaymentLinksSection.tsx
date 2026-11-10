import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { translatorFor, useI18n } from '../i18n/I18nContext';
import {
  createPaymentLink,
  deletePaymentLink,
  getCampaigns,
  getPaymentLinks,
  updatePaymentLink,
  type PaymentLink,
  type PaymentLinkInput,
} from '../api/donations';
import { API_BASE_URL } from '../api/client';
import { getPoi } from '../api/pois';
import type { Campaign, Poi } from '../api/types';
import { Lockup } from '../components/LogoMark';

/**
 * Payment links (Seb, 10 Nov 2026): a community makes as many links as it
 * needs ("Christmas lunch", 15 € each, until 20 December), each with its
 * own QR code, and sees what each has collected. Anyone pays from the
 * link with card, Apple Pay or Google Pay, with no app and no account.
 * The community's own "Contribute" link is always there. Served by the
 * API at /m/pay/:code.
 */

type Draft = { title: string; message: string; campaignId: string; fixed: boolean; amount: string; askName: boolean; endsOn: string };

const EMPTY: Draft = { title: '', message: '', campaignId: '', fixed: false, amount: '', askName: true, endsOn: '' };

function draftOf(link: PaymentLink): Draft {
  return {
    title: link.title,
    message: link.message ?? '',
    campaignId: link.campaignId ?? '',
    fixed: link.amount !== null,
    amount: link.amount !== null ? String(link.amount).replace('.', ',') : '',
    askName: link.askName,
    endsOn: link.endsOn ?? '',
  };
}

function linkUrl(code: string): string {
  return `${API_BASE_URL}/m/pay/${code}`;
}

function euros(amount: number, language: string): string {
  const locale = language === 'va' || language === 'ca' ? 'ca-ES' : language === 'pt' ? 'pt-PT' : language;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount);
}

function fileSafe(text: string): string {
  return text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'infunion';
}

export function PaymentLinksSection({ poiId }: { poiId: string }) {
  const { t, language } = useI18n();
  const [poi, setPoi] = useState<Poi | null>(null);
  const [links, setLinks] = useState<PaymentLink[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // The link open below the list: its id, 'new' for a new one, or null.
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPoi(poiId).then(setPoi).catch(() => setPoi(null));
    getCampaigns(poiId)
      .then((list) => setCampaigns(list.filter((c) => c.active)))
      .catch(() => setCampaigns([]));
    getPaymentLinks(poiId)
      .then((list) => {
        setLinks(list);
        if (list[0]) open(list[0]);
      })
      .catch(() => setLinks([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poiId]);

  function open(link: PaymentLink) {
    setOpenId(link.id);
    setDraft(draftOf(link));
    setError(null);
  }

  function startNew() {
    setOpenId('new');
    setDraft(EMPTY);
    setError(null);
  }

  const current = links?.find((l) => l.id === openId) ?? null;

  function input(): PaymentLinkInput | null {
    const title = draft.title.trim();
    if (!title) {
      setError(t('paymentLinks.errorTitle'));
      return null;
    }
    let amount: number | null = null;
    if (draft.fixed) {
      amount = Number(draft.amount.replace(',', '.'));
      if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
        setError(t('paymentLinks.errorAmount'));
        return null;
      }
      amount = Math.round(amount * 100) / 100;
    }
    return { title, message: draft.message.trim() || null, campaignId: draft.campaignId || null, amount, askName: draft.askName, endsOn: draft.endsOn || null };
  }

  async function save() {
    const body = input();
    if (!body) return;
    setSaving(true);
    setError(null);
    try {
      if (openId === 'new') {
        const created = await createPaymentLink(poiId, body);
        setLinks((list) => {
          const [own, ...rest] = list ?? [];
          return own?.isDefault ? [own, created, ...rest] : [created, ...(list ?? [])];
        });
        open(created);
      } else if (current) {
        // The community's own link keeps its name and stays general.
        const changes = current.isDefault ? { message: body.message, amount: body.amount, askName: body.askName } : body;
        const updated = await updatePaymentLink(poiId, current.id, changes);
        setLinks((list) => (list ?? []).map((l) => (l.id === updated.id ? updated : l)));
        open(updated);
      }
    } catch {
      setError(t('paymentLinks.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!current || current.isDefault) return;
    if (!window.confirm(t('paymentLinks.removeConfirm'))) return;
    try {
      await deletePaymentLink(poiId, current.id);
      const rest = (links ?? []).filter((l) => l.id !== current.id);
      setLinks(rest);
      if (rest[0]) open(rest[0]);
      else setOpenId(null);
    } catch {
      setError(t('paymentLinks.errorSave'));
    }
  }

  if (!links || !poi) return null;

  // The browser's own day, as YYYY-MM-DD, to say which links have ended.
  const today = new Date().toLocaleDateString('en-CA');

  const amountLabel = (link: PaymentLink) =>
    link.amount === null ? t('paymentLinks.payerChooses') : t('paymentLinks.each', { amount: euros(link.amount, language) });

  return (
    <div>
      <div className="card">
        <div className="paylinks-head">
          <div>
            <p className="card-title">{t('paymentLinks.listTitle')}</p>
            <p className="card-meta">{t('paymentLinks.intro')}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={startNew}>
            + {t('paymentLinks.new')}
          </button>
        </div>
        <div className="paylinks-scroll">
          <table className="data-table paylinks-table">
            <thead>
              <tr>
                <th>{t('paymentLinks.colName')}</th>
                <th>{t('paymentLinks.colAmount')}</th>
                <th>{t('paymentLinks.colPaid')}</th>
                <th>{t('paymentLinks.colCollected')}</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr
                  key={link.id}
                  className={link.id === openId ? 'paylinks-selected' : undefined}
                  onClick={() => open(link)}
                >
                  <td>
                    <button type="button" className="paylinks-name" onClick={() => open(link)}>
                      {link.title}
                    </button>
                    {link.isDefault && <span className="paylinks-tag paylinks-tag-muted">{t('paymentLinks.alwaysOn')}</span>}
                    {link.campaignTitle && !link.isDefault && <span className="paylinks-tag">{link.campaignTitle}</span>}
                    {link.endsOn && link.endsOn < today && (
                      <span className="paylinks-tag paylinks-tag-muted">{t('paymentLinks.ended')}</span>
                    )}
                    {link.endsOn && link.endsOn >= today && (
                      <span className="paylinks-tag">
                        {t('paymentLinks.until', {
                          date: new Date(`${link.endsOn}T12:00:00`).toLocaleDateString(language, { day: 'numeric', month: 'short' }),
                        })}
                      </span>
                    )}
                  </td>
                  <td>{amountLabel(link)}</td>
                  <td>{link.paidCount}</td>
                  <td>{euros(link.paidTotal, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openId && (
        <div className="card">
          <p className="card-title">{openId === 'new' ? t('paymentLinks.new') : current?.title}</p>
          <div className="form paylinks-form">
            {!current?.isDefault && (
              <>
                <label>
                  {t('paymentLinks.titleLabel')}
                  <input
                    value={draft.title}
                    maxLength={120}
                    placeholder={t('paymentLinks.titlePlaceholder')}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>
                <label>
                  {t('paymentLinks.goesTo')}
                  <select value={draft.campaignId} onChange={(e) => setDraft({ ...draft, campaignId: e.target.value })}>
                    <option value="">{t('payLink.general')}</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              {t('paymentLinks.messageLabel')}
              <textarea
                value={draft.message}
                maxLength={300}
                rows={2}
                placeholder={translatorFor(poi.language)('paymentLinks.messagePlaceholder')}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              />
            </label>
            <div className="form-row">
              {t('paymentLinks.amountLabel')}
              <div className="paylinks-seg" role="radiogroup">
                <button type="button" role="radio" aria-checked={!draft.fixed} className={!draft.fixed ? 'on' : undefined} onClick={() => setDraft({ ...draft, fixed: false })}>
                  {t('paymentLinks.payerChooses')}
                </button>
                <button type="button" role="radio" aria-checked={draft.fixed} className={draft.fixed ? 'on' : undefined} onClick={() => setDraft({ ...draft, fixed: true })}>
                  {t('paymentLinks.fixedAmount')}
                </button>
              </div>
            </div>
            {draft.fixed && (
              <label>
                {t('paymentLinks.fixedLabel')}
                <input
                  inputMode="decimal"
                  value={draft.amount}
                  placeholder="15"
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </label>
            )}
            <div className="form-row">
              {t('paymentLinks.askName')}
              <div className="paylinks-seg" role="radiogroup">
                <button type="button" role="radio" aria-checked={draft.askName} className={draft.askName ? 'on' : undefined} onClick={() => setDraft({ ...draft, askName: true })}>
                  {t('paymentLinks.yes')}
                </button>
                <button type="button" role="radio" aria-checked={!draft.askName} className={!draft.askName ? 'on' : undefined} onClick={() => setDraft({ ...draft, askName: false })}>
                  {t('paymentLinks.no')}
                </button>
              </div>
            </div>
            {!current?.isDefault && (
              <label>
                {t('paymentLinks.endsOn')}
                <input type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} />
              </label>
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="card-actions paylinks-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
              {openId === 'new' ? t('paymentLinks.create') : t('paymentLinks.save')}
            </button>
            {current && !current.isDefault && (
              <button type="button" className="btn btn-destructive" onClick={remove}>
                {t('paymentLinks.remove')}
              </button>
            )}
          </div>
          {current && <ShareLink link={current} poi={poi} />}
        </div>
      )}
    </div>
  );
}

/** The link's QR code and the ways to share it, and its printable poster. */
function ShareLink({ link, poi }: { link: PaymentLink; poi: Poi }) {
  const { t } = useI18n();
  const url = linkUrl(link.code);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#1f1b2e' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (e.g. not https): the link is selectable anyway.
    }
  }

  const flyerT = translatorFor(poi.language);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${link.title}: ${url}`)}`;

  return (
    <>
      <div className="paylinks-share">
        {qr && <img src={qr} alt={t('payLink.qrAlt')} width={160} height={160} />}
        <div>
          <p className="card-title">{t('paymentLinks.shareTitle')}</p>
          <p className="paylink-url">{url}</p>
          <div className="card-actions">
            <button type="button" className="btn btn-primary" onClick={copy}>
              {copied ? t('payLink.copied') : t('payLink.copy')}
            </button>
            <a className="btn" href={whatsapp} target="_blank" rel="noreferrer">
              {t('paymentLinks.whatsapp')}
            </a>
            {qr && (
              <a className="btn" href={qr} download={`${fileSafe(poi.name)}-${fileSafe(link.title)}-qr.png`}>
                {t('payLink.download')}
              </a>
            )}
            <button type="button" className="btn" onClick={() => window.print()}>
              {t('payLink.print')}
            </button>
            <a className="btn" href={url} target="_blank" rel="noreferrer">
              {t('payLink.open')}
            </a>
          </div>
        </div>
      </div>

      {qr && (
        <>
          <p className="card-title" style={{ marginTop: 24 }}>
            {t('payLink.previewTitle')}
          </p>
          <div className="qr-flyer">
            <div className="qr-flyer-inner">
              {poi.pictureUrl && <img src={poi.pictureUrl} alt={poi.name} className="qr-flyer-logo" />}
              <p className="qr-flyer-poi-name">{poi.name}</p>
              <h1 className="qr-flyer-headline">{link.title}</h1>
              {link.message && <p className="qr-flyer-subtext">{link.message}</p>}
              {(link.amount !== null || link.endsOn) && (
                <p className="qr-flyer-subtext">
                  {[
                    link.amount !== null ? flyerT('paymentLinks.flyerEach', { amount: euros(link.amount, poi.language) }) : null,
                    link.endsOn
                      ? flyerT('paymentLinks.flyerUntil', {
                          date: new Date(`${link.endsOn}T12:00:00`).toLocaleDateString(poi.language, { day: 'numeric', month: 'long' }),
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
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
      )}
    </>
  );
}
