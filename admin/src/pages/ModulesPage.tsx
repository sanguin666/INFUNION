import { useEffect, useState } from 'react';
import { usePoiId, useRefreshModules } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale, type Translations } from '../i18n/translations';
import {
  getBilling,
  resumeModule,
  setBillingInterval,
  setPaymentMethod,
  startModule,
  stopModule,
  subscribeModule,
} from '../api/billing';
import type { ActiveModule, BillingInterval, BillingSummary, ModuleType } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';

type Key<S extends keyof Translations> = `${S}.${Extract<keyof Translations[S], string>}`;

// In the order an office is likely to want them.
const MODULES: { type: ModuleType; name: Key<'moduleNames'>; description: Key<'billing'> }[] = [
  { type: 'events', name: 'moduleNames.events', description: 'billing.descEvents' },
  { type: 'requests', name: 'moduleNames.requests', description: 'billing.descRequests' },
  { type: 'messages', name: 'moduleNames.messages', description: 'billing.descMessages' },
  { type: 'donations', name: 'moduleNames.donations', description: 'billing.descDonations' },
  { type: 'mass_intentions', name: 'moduleNames.massIntentions', description: 'billing.descMassIntentions' },
  { type: 'announcements', name: 'moduleNames.announcements', description: 'billing.descAnnouncements' },
  { type: 'daily_readings', name: 'moduleNames.readings', description: 'billing.descReadings' },
  { type: 'livestreams', name: 'moduleNames.livestream', description: 'billing.descLivestreams' },
  { type: 'prayer_requests', name: 'moduleNames.prayerRequests', description: 'billing.descPrayerRequests' },
  { type: 'community', name: 'moduleNames.community', description: 'billing.descCommunity' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE = new Set(['trial', 'active']);

/**
 * Modules (Seb, 30 Sep 2026): what the community runs and what it pays
 * for it, apart from Paramètres because switching a module on is now a
 * purchase. Événements is free; every other module is tried free for a
 * month, then 10 € a month or 110 € a year, all on one bill.
 */
export function ModulesPage() {
  const poiId = usePoiId();
  const refreshModules = useRefreshModules();
  const { t, language } = useI18n();
  // Kept with its place, so switching places never shows the last one's.
  const [loaded, setLoaded] = useState<{ poiId: string; billing: BillingSummary } | null>(null);
  const billing = loaded && loaded.poiId === poiId ? loaded.billing : null;
  const setBilling = (next: BillingSummary) => setLoaded({ poiId, billing: next });
  const [now] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // The row whose "Essayer 1 mois gratuit" is waiting for its answer.
  const [confirmingTrial, setConfirmingTrial] = useState<ModuleType | null>(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentKind, setPaymentKind] = useState<'sepa' | 'card'>('sepa');
  const [last4, setLast4] = useState('');
  const [showInvoices, setShowInvoices] = useState(false);

  useEffect(() => {
    getBilling(poiId)
      .then((next) => setLoaded({ poiId, billing: next }))
      .catch(() => setError(t('billing.loadError')));
  }, [poiId]);

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' });
  const money = (amount: number) =>
    amount.toLocaleString(intlLocale(language), { style: 'currency', currency: 'EUR', minimumFractionDigits: amount % 1 ? 2 : 0 });

  async function run(key: string, action: () => Promise<BillingSummary>) {
    setPending(key);
    setError(null);
    try {
      setBilling(await action());
      refreshModules();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message.includes('payment_method_required') ? t('billing.needsPayment') : t('billing.actionError'));
    } finally {
      setPending(null);
    }
  }

  if (!billing) {
    return (
      <div>
        <h2>{t('billing.title')}</h2>
        {error ? <p className="error-text">{error}</p> : <p className="muted">{t('billing.loading')}</p>}
      </div>
    );
  }

  const interval = billing.interval;
  const unitPrice = billing.prices[interval];
  const priceLabel = t(interval === 'yearly' ? 'billing.priceYear' : 'billing.priceMonth', { price: money(unitPrice) });
  const rowFor = (type: ModuleType) => billing.modules.find((m) => m.moduleType === type);
  const isFree = (type: ModuleType) => billing.freeModules.includes(type);
  // What the next bill will hold: paid modules that carry on, and trials
  // that will turn into paid ones (only with a payment method).
  const payingNext = billing.modules.filter(
    (m) =>
      !isFree(m.moduleType) &&
      !m.offered &&
      ((m.status === 'active' && !m.cancelAtPeriodEnd) || (m.status === 'trial' && billing.paymentMethod)),
  ).length;
  const endingTrials = billing.modules.filter(
    (m) => m.status === 'trial' && m.trialEndsAt && new Date(m.trialEndsAt).getTime() - now < 7 * DAY_MS,
  );
  const nameOf = (type: ModuleType) => t(MODULES.find((m) => m.type === type)!.name);

  function status(type: ModuleType, row: ActiveModule | undefined): { text: string; on: boolean } {
    const live = !!row && LIVE.has(row.status);
    // Given by ANSAE from the superadmin: on, and nothing to pay.
    if (live && row.offered) return { text: t('billing.offered'), on: true };
    if (billing!.comped || isFree(type)) {
      return live
        ? { text: billing!.comped && !isFree(type) ? t('billing.offered') : t('billing.included'), on: true }
        : { text: t('billing.notActivated'), on: false };
    }
    if (!row) return { text: t('billing.notActivated'), on: false };
    if (row.status === 'trial' && row.trialEndsAt) {
      const days = Math.max(1, Math.ceil((new Date(row.trialEndsAt).getTime() - now) / DAY_MS));
      return {
        text: billing!.paymentMethod
          ? t('billing.trialLeft', { days, price: priceLabel, date: date(row.trialEndsAt) })
          : t('billing.trialNeedsPayment', { days, date: date(row.trialEndsAt) }),
        on: true,
      };
    }
    if (row.status === 'active' && row.cancelAtPeriodEnd && row.paidUntil) {
      return { text: t('billing.stops', { date: date(row.paidUntil) }), on: true };
    }
    if (row.status === 'active') return { text: t('billing.active', { price: priceLabel }), on: true };
    if (row.status === 'expired') return { text: t('billing.paused'), on: false };
    return { text: t('billing.stopped'), on: false };
  }

  function actions(type: ModuleType, row: ActiveModule | undefined) {
    const busy = pending === type;
    const live = !!row && LIVE.has(row.status);
    if (live) {
      if (row.cancelAtPeriodEnd) {
        return (
          <button type="button" className="btn" disabled={busy} onClick={() => run(type, () => resumeModule(poiId, type))}>
            {t('billing.keep')}
          </button>
        );
      }
      return (
        <DestructiveButton
          label={row.status === 'trial' && !billing!.comped ? t('billing.stopTrial') : t('billing.stop')}
          disabled={busy}
          onConfirm={() => run(type, () => stopModule(poiId, type))}
        />
      );
    }
    if (billing!.comped || isFree(type)) {
      return (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(type, () => startModule(poiId, type))}>
          {t('billing.activate')}
        </button>
      );
    }
    if (!row) {
      return (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setConfirmingTrial(type)}>
          {t('billing.tryFree')}
        </button>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => {
          if (!billing!.paymentMethod) {
            setError(t('billing.needsPayment'));
            setEditingPayment(true);
            return;
          }
          run(type, () => subscribeModule(poiId, type));
        }}
      >
        {t('billing.subscribe', { price: priceLabel })}
      </button>
    );
  }

  function moduleRow(type: ModuleType) {
    const entry = MODULES.find((m) => m.type === type)!;
    const row = rowFor(type);
    const { text, on } = status(type, row);
    const trialEnd = new Date(now);
    trialEnd.setMonth(trialEnd.getMonth() + 1);
    return (
      <div key={type} className="card-row module-row">
        <div className="module-row-main">
          <div className="module-row-text">
            <p className="card-title">{t(entry.name)}</p>
            <p className="muted module-desc">{t(entry.description)}</p>
            <span className={`badge ${on ? 'badge-active' : ''}`}>{text}</span>
          </div>
          {confirmingTrial !== type && <div className="card-actions module-actions">{actions(type, row)}</div>}
        </div>
        {confirmingTrial === type && (
          <div className="module-confirm">
            <p>{t('billing.trialConfirm', { date: date(trialEnd.toISOString()), price: priceLabel })}</p>
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                disabled={pending === type}
                onClick={() => {
                  setConfirmingTrial(null);
                  run(type, () => startModule(poiId, type));
                }}
              >
                {t('billing.startTrial')}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmingTrial(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const free = MODULES.filter((m) => isFree(m.type));
  const paid = MODULES.filter((m) => !isFree(m.type));
  const latest = billing.invoices[0];

  return (
    <div>
      <h2>{t('billing.title')}</h2>
      <p className="muted">{billing.comped ? t('billing.subtitleOffered') : t('billing.subtitle')}</p>

      {error && <p className="error-text">{error}</p>}

      {!billing.comped && endingTrials.length > 0 && (
        <div className="card">
          {endingTrials.map((m) => (
            <p key={m.id} className="module-alert">
              {t(billing.paymentMethod ? 'billing.trialEndingPaid' : 'billing.trialEndingUnpaid', {
                module: nameOf(m.moduleType),
                date: date(m.trialEndsAt!),
                price: priceLabel,
              })}
            </p>
          ))}
        </div>
      )}

      {billing.comped ? (
        <div className="card">
          <p className="card-title">{t('billing.offeredTitle')}</p>
          <p className="muted" style={{ marginTop: 4 }}>
            {t('billing.offeredBody')}
          </p>
        </div>
      ) : (
        <div className="card">
          <p className="card-title">{t('billing.subscriptionTitle')}</p>
          <div className="billing-figures">
            <div>
              <p className="billing-figure">{payingNext}</p>
              <p className="muted">{t('billing.paidModules')}</p>
            </div>
            <div>
              <p className="billing-figure">{money(payingNext * unitPrice)}</p>
              <p className="muted">{t(interval === 'yearly' ? 'billing.perYear' : 'billing.perMonth')}</p>
            </div>
            <div>
              <p className="billing-figure">{billing.renewsAt ? date(billing.renewsAt) : '—'}</p>
              <p className="muted">{t('billing.nextCharge')}</p>
            </div>
          </div>

          <div className="form">
            <div className="form-row">
              <span className="form-label">{t('billing.intervalLabel')}</span>
              {(['monthly', 'yearly'] as BillingInterval[]).map((option) => (
                <label key={option} className="radio-row">
                  <input
                    type="radio"
                    name="billing-interval"
                    checked={interval === option}
                    disabled={pending === 'interval'}
                    onChange={() => run('interval', () => setBillingInterval(poiId, option))}
                  />
                  <span>
                    <strong>{t(option === 'yearly' ? 'billing.yearly' : 'billing.monthly')}</strong>
                    {' · '}
                    {t('billing.perModule', { price: money(billing.prices[option]) })}
                    {option === 'yearly' && <span className="muted"> · {t('billing.yearlyHint')}</span>}
                  </span>
                </label>
              ))}
              {billing.renewsAt && <p className="muted module-desc">{t('billing.intervalNote')}</p>}
            </div>

            <div className="form-row">
              <span className="form-label">{t('billing.paymentLabel')}</span>
              {editingPayment ? (
                <>
                  <select value={paymentKind} onChange={(e) => setPaymentKind(e.target.value as 'sepa' | 'card')}>
                    <option value="sepa">{t('billing.sepa')}</option>
                    <option value="card">{t('billing.card')}</option>
                  </select>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={last4}
                    placeholder={t('billing.last4')}
                    aria-label={t('billing.last4')}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                  />
                  <p className="muted module-desc">{t('billing.demoNote')}</p>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={last4.length !== 4 || pending === 'payment'}
                      onClick={() =>
                        run('payment', () => setPaymentMethod(poiId, paymentKind, last4)).then(() => {
                          setEditingPayment(false);
                          setLast4('');
                        })
                      }
                    >
                      {t('billing.save')}
                    </button>
                    <button type="button" className="btn" onClick={() => setEditingPayment(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="billing-line">
                  <span>{billing.paymentMethod ?? t('billing.noPaymentMethod')}</span>
                  <button type="button" className="btn" onClick={() => setEditingPayment(true)}>
                    {billing.paymentMethod ? t('billing.change') : t('billing.add')}
                  </button>
                </div>
              )}
            </div>

            <div className="form-row">
              <span className="form-label">{t('billing.invoicesLabel')}</span>
              {latest ? (
                <>
                  <div className="billing-line">
                    <span>
                      {date(latest.issuedAt)} · {money(latest.amount)}
                    </span>
                    <button type="button" className="btn" onClick={() => setShowInvoices((v) => !v)}>
                      {showInvoices ? t('billing.hideInvoices') : t('billing.showInvoices')}
                    </button>
                  </div>
                  {showInvoices &&
                    billing.invoices.map((invoice) => (
                      <p key={invoice.id} className="muted module-desc">
                        {date(invoice.issuedAt)} · {money(invoice.amount)} ·{' '}
                        {invoice.lines.map((line) => nameOf(line.moduleType)).join(', ')}
                      </p>
                    ))}
                </>
              ) : (
                <span>{t('billing.noInvoices')}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {!billing.comped && free.length > 0 && (
        <>
          <h3 className="modules-heading">{t('billing.includedTitle')}</h3>
          <div className="card card-list">{free.map((m) => moduleRow(m.type))}</div>
        </>
      )}

      <h3 className="modules-heading">{billing.comped ? t('billing.allModulesTitle') : t('billing.paidTitle')}</h3>
      <div className="card card-list">{(billing.comped ? MODULES : paid).map((m) => moduleRow(m.type))}</div>
    </div>
  );
}
