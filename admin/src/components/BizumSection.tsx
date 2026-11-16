import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { setBizumPhone, type PayoutsAccount } from '../api/payouts';
import { confirmBizum, getBizumPending, type BizumPending } from '../api/donations';

/**
 * How members can pay (Seb, 16 Nov 2026): the community's own Stripe
 * account (card, Apple Pay, Google Pay, PayPal) and, optionally, its own
 * Bizum number. Stays usable while the rest of the page is greyed out, so
 * a community can take Bizum before its Stripe account is ready.
 */
export function PaymentMethodsCard({
  poiId,
  account,
  onChange,
}: {
  poiId: string;
  account: PayoutsAccount;
  onChange: (account: PayoutsAccount) => void;
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState(account.bizumPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'invalid' | 'error' | null>(null);

  useEffect(() => setPhone(account.bizumPhone ?? ''), [account.bizumPhone]);

  async function save(value: string) {
    setSaving(true);
    setStatus(null);
    try {
      const updated = await setBizumPhone(poiId, value);
      onChange(updated);
      setPhone(updated.bizumPhone ?? '');
      setStatus('saved');
    } catch (error) {
      setStatus(String((error as Error).message).includes('invalid') ? 'invalid' : 'error');
    } finally {
      setSaving(false);
    }
  }

  const changed = phone.replace(/\s/g, '') !== (account.bizumPhone ?? '').replace(/\s/g, '');

  return (
    <section className="chart-card pay-methods" aria-labelledby="pay-methods-title">
      <h3 id="pay-methods-title">{t('bizum.methodsTitle')}</h3>
      <div className="pay-methods-row">
        <span className="muted">{t('bizum.cardLabel')}</span>
        <span className="pay-methods-value">
          {t('bizum.cardThrough')}{' '}
          <span className={account.ready ? 'badge badge-active' : 'badge'}>
            {account.ready ? t('bizum.cardReady') : t('bizum.cardNotReady')}
          </span>
        </span>
      </div>
      <div className="pay-methods-row">
        <label className="pay-methods-label">
          <span className="muted">{t('bizum.numberLabel')}</span>
          <input
            className="pay-methods-input"
            value={phone}
            inputMode="tel"
            maxLength={20}
            placeholder={t('bizum.numberPlaceholder')}
            onChange={(e) => {
              setPhone(e.target.value);
              setStatus(null);
            }}
          />
        </label>
        <p className="muted pay-methods-hint">{t('bizum.numberHint')}</p>
        <div className="pay-methods-actions">
          <button type="button" className="btn btn-primary" disabled={saving || !changed || !phone.trim()} onClick={() => save(phone)}>
            {t('bizum.save')}
          </button>
          {account.bizumPhone && (
            <button type="button" className="text-action text-action-destructive" disabled={saving} onClick={() => save('')}>
              {t('bizum.remove')}
            </button>
          )}
          {status === 'saved' && <span className="muted">{t('bizum.saved')}</span>}
        </div>
        {status === 'invalid' && <p className="error-text">{t('bizum.invalid')}</p>}
        {status === 'error' && <p className="error-text">{t('bizum.saveError')}</p>}
      </div>
    </section>
  );
}

function sentWhen(iso: string, t: ReturnType<typeof useI18n>['t'], locale: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return time;
  if (date.toDateString() === yesterday.toDateString()) return `${t('bizum.yesterday')} ${time}`;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** The Bizums members say they sent, for the team to find on the statement. */
export function BizumToConfirm({ poiId, onConfirmed }: { poiId: string; onConfirmed: () => void }) {
  const { t, language } = useI18n();
  const [rows, setRows] = useState<BizumPending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getBizumPending(poiId)
      .then(setRows)
      .catch(() => setRows([]));
  }, [poiId]);

  async function answer(id: string, received: boolean) {
    setBusy(id);
    try {
      await confirmBizum(poiId, id, received);
      setRows((current) => current.filter((row) => row.id !== id));
      if (received) onConfirmed();
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return null;
  const money = new Intl.NumberFormat(language === 'en' ? 'en-IE' : language === 'va' || language === 'ca' ? 'ca-ES' : language === 'pt' ? 'pt-PT' : language, {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <section className="chart-card bizum-confirm" aria-labelledby="bizum-confirm-title">
      <div className="chart-card-header">
        <h3 id="bizum-confirm-title">
          {t('bizum.pendingTitle')} <span className="badge">{rows.length}</span>
        </h3>
      </div>
      <p className="muted">{t('bizum.pendingIntro')}</p>
      <table className="bizum-table">
        <thead>
          <tr>
            <th>{t('bizum.who')}</th>
            <th>{t('bizum.concept')}</th>
            <th>{t('bizum.amount')}</th>
            <th>{t('bizum.sent')}</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.donorName ?? t('bizum.guest')}
                {row.campaignTitle && <span className="card-meta" style={{ display: 'block' }}>{row.campaignTitle}</span>}
              </td>
              <td>
                <code className="bizum-code">{row.code}</code>
              </td>
              <td className="donation-amount">{money.format(row.amount)}</td>
              <td className="muted">{sentWhen(row.sentAt, t, language)}</td>
              <td className="bizum-actions">
                <button type="button" className="btn btn-primary" disabled={busy === row.id} onClick={() => answer(row.id, true)}>
                  {t('bizum.received')}
                </button>
                <button type="button" className="btn" disabled={busy === row.id} onClick={() => answer(row.id, false)}>
                  {t('bizum.notReceived')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small bizum-foot">{t('bizum.pendingFoot')}</p>
    </section>
  );
}
