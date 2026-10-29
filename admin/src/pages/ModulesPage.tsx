import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePoiId, useRefreshModules } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale, type Translations } from '../i18n/translations';
import {
  choosePlan,
  getBilling,
  setBillingInterval,
  setPaymentMethod,
  startModule,
  startPlanTrial,
  stopModule,
} from '../api/billing';
import type { ActiveModule, BillingInterval, BillingSummary, ModuleType, PlanTier } from '../api/types';

type Key<S extends keyof Translations> = `${S}.${Extract<keyof Translations[S], string>}`;

type ModuleInfo = {
  type: ModuleType;
  name: Key<'moduleNames'>;
  description: Key<'billing'>;
  // One line each for "Learn more": what members get, what the team gets.
  members: Key<'plans'>;
  team: Key<'plans'>;
  // Its colour on the page (see .module-card in index.css).
  hue: string;
  icon: string;
};

// In plan order, then the order an office is likely to want them.
const MODULES: ModuleInfo[] = [
  { type: 'events', name: 'moduleNames.events', description: 'billing.descEvents', members: 'plans.evM', team: 'plans.evT', hue: 'events', icon: 'M4 7h16v13H4zM4 7V5h16v2M8 3v4M16 3v4M8 12h3' },
  { type: 'donations', name: 'moduleNames.donations', description: 'billing.descDonations', members: 'plans.doM', team: 'plans.doT', hue: 'donations', icon: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  { type: 'announcements', name: 'moduleNames.announcements', description: 'billing.descAnnouncements', members: 'plans.anM', team: 'plans.anT', hue: 'announcements', icon: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6' },
  { type: 'requests', name: 'moduleNames.requests', description: 'billing.descRequests', members: 'plans.reM', team: 'plans.reT', hue: 'requests', icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5' },
  { type: 'messages', name: 'moduleNames.messages', description: 'billing.descMessages', members: 'plans.meM', team: 'plans.meT', hue: 'messages', icon: 'M4 5h16v11H9l-5 4z' },
  { type: 'community', name: 'moduleNames.community', description: 'billing.descCommunity', members: 'plans.coM', team: 'plans.coT', hue: 'community', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M21 19a5 5 0 0 0-4-5' },
  { type: 'livestreams', name: 'moduleNames.livestream', description: 'billing.descLivestreams', members: 'plans.liM', team: 'plans.liT', hue: 'livestreams', icon: 'M3 7h12v10H3zM15 11l6-3v8l-6-3' },
  { type: 'prayer_requests', name: 'moduleNames.prayerRequests', description: 'billing.descPrayerRequests', members: 'plans.prM', team: 'plans.prT', hue: 'prayer', icon: 'M12 3v6M9 6h6M6 21l3-9h6l3 9' },
  { type: 'daily_readings', name: 'moduleNames.readings', description: 'billing.descReadings', members: 'plans.rdM', team: 'plans.rdT', hue: 'readings', icon: 'M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1zM12 6v14' },
  { type: 'mass_intentions', name: 'moduleNames.massIntentions', description: 'billing.descMassIntentions', members: 'plans.miM', team: 'plans.miT', hue: 'mass', icon: 'M12 3v4M10 5h4M7 21V11l5-3 5 3v10M10 21v-5h4v5' },
];

const PLAN_ORDER: PlanTier[] = ['basic', 'essentials', 'complete'];
const BLURB: Record<PlanTier, Key<'plans'>> = {
  basic: 'plans.basicBlurb',
  essentials: 'plans.essentialsBlurb',
  complete: 'plans.completeBlurb',
};
const BELL = 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0';
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE = new Set(['trial', 'active']);

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/**
 * Plans and modules (Seb, 29 Oct 2026; per-module prices before that).
 * Three plans, Basic free, Essentials and Complete paid monthly or for a
 * year at ten months' price; a paid plan can be tried free for a month,
 * once. The plan opens a set of modules, and each one shows as a coloured
 * card the office can show or hide in the app at no cost. Push
 * notifications come with Essentials: Basic is the app alone.
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
  // The plan whose button is waiting for "Confirmer".
  const [confirming, setConfirming] = useState<{ tier: PlanTier; trial: boolean } | null>(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentKind, setPaymentKind] = useState<'sepa' | 'card'>('sepa');
  const [last4, setLast4] = useState('');
  const [showInvoices, setShowInvoices] = useState(false);
  const [details, setDetails] = useState<ModuleInfo | null>(null);
  const plansRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBilling(poiId)
      .then((next) => setLoaded({ poiId, billing: next }))
      .catch(() => setError(t('billing.loadError')));
  }, [poiId]);

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' });
  const money = (amount: number) =>
    amount.toLocaleString(intlLocale(language), { style: 'currency', currency: 'EUR', minimumFractionDigits: amount % 1 ? 2 : 0 });
  const planName = (tier: PlanTier) => t(`plans.${tier}`);

  async function run(key: string, action: () => Promise<BillingSummary>): Promise<boolean> {
    setPending(key);
    setError(null);
    try {
      setBilling(await action());
      refreshModules();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('payment_method_required')) {
        setError(t('plans.needsPayment'));
        setEditingPayment(true);
        paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setError(t('billing.actionError'));
      }
      return false;
    } finally {
      setPending(null);
    }
  }

  if (!billing) {
    return (
      <div>
        <h2>{t('plans.title')}</h2>
        {error ? <p className="error-text">{error}</p> : <p className="muted">{t('billing.loading')}</p>}
      </div>
    );
  }

  const interval = billing.interval;
  const plan = billing.plan;
  const rank = (tier: PlanTier) => PLAN_ORDER.indexOf(tier);
  const offerOf = (tier: PlanTier) => billing.plans.find((p) => p.tier === tier)!;
  const priceOf = (tier: PlanTier, on: BillingInterval = interval) =>
    `${money(offerOf(tier).prices[on])} ${t(on === 'yearly' ? 'plans.perYear' : 'plans.perMonth')}`;
  const fixed = billing.comped || billing.planOffered;
  const paying = !fixed && plan !== 'basic' && !billing.trialEndsAt;
  const shown = MODULES.filter((m) => billing.availableModules.includes(m.type));
  const planOf = (type: ModuleType) => billing.plans.find((p) => p.adds.includes(type))?.tier ?? 'complete';
  const rowFor = (type: ModuleType) => billing.modules.find((m) => m.moduleType === type);
  const inPlan = (type: ModuleType) => !!rowFor(type)?.offered || rank(planOf(type)) <= rank(plan);
  const trialDays = billing.trialEndsAt ? Math.max(1, Math.ceil((new Date(billing.trialEndsAt).getTime() - now) / DAY_MS)) : 0;

  function confirmText(tier: PlanTier, trial: boolean): string {
    const until = new Date(now);
    until.setMonth(until.getMonth() + 1);
    if (trial) return t('plans.confirmTrial', { plan: planName(tier), date: date(until.toISOString()) });
    if (rank(tier) > rank(plan)) {
      // A bigger plan during the free month: the month carries on with it.
      if (billing!.trialEndsAt) return t('plans.confirmTrial', { plan: planName(tier), date: date(billing!.trialEndsAt) });
      return paying && billing!.renewsAt
        ? t('plans.confirmUpPaid', { plan: planName(tier), date: date(billing!.renewsAt), price: priceOf(tier) })
        : t('plans.confirmUpNew', { plan: planName(tier), price: priceOf(tier) });
    }
    return paying && billing!.renewsAt
      ? t('plans.confirmDown', { current: planName(plan), plan: planName(tier), date: date(billing!.renewsAt) })
      : t('plans.confirmDownNow', { plan: planName(tier) });
  }

  function planAction(tier: PlanTier) {
    if (fixed) return null;
    if (tier === plan) {
      if (billing!.pendingPlan) {
        return (
          <button type="button" className="btn" disabled={!!pending} onClick={() => run('keep', () => choosePlan(poiId, plan))}>
            {t('plans.keep', { plan: planName(plan) })}
          </button>
        );
      }
      return <span className="plan-mine">{t('plans.yourPlan')}</span>;
    }
    if (billing!.pendingPlan === tier) {
      return <span className="muted">{t('plans.pendingNote', { plan: planName(tier), date: date(billing!.renewsAt!) })}</span>;
    }
    const trial = rank(tier) > rank(plan) && plan === 'basic' && !billing!.trialUsed;
    const up = rank(tier) > rank(plan);
    return (
      <button
        type="button"
        className={`btn ${up ? 'btn-primary' : ''}`}
        disabled={!!pending}
        onClick={() => setConfirming({ tier, trial })}
      >
        {trial ? t('plans.tryFree') : t('plans.switchTo', { plan: planName(tier) })}
      </button>
    );
  }

  function planCard(tier: PlanTier) {
    const offer = offerOf(tier);
    const mine = tier === plan;
    const below = PLAN_ORDER[rank(tier) - 1];
    return (
      <article key={tier} className={`card plan-card${mine ? ' plan-card-mine' : ''}${tier === 'essentials' ? ' plan-card-featured' : ''}`}>
        <div className="plan-card-top">
          <h3>{planName(tier)}</h3>
          {tier === 'essentials' && <span className="plan-pill">{t('plans.recommended')}</span>}
        </div>
        <p className="muted plan-blurb">{t(BLURB[tier])}</p>
        {offer.prices.monthly ? (
          <>
            <p className="plan-price">
              <span className="plan-price-big">{money(offer.prices.monthly)}</span>
              <span className="muted">{t('plans.perMonth')}</span>
            </p>
            <p className="muted plan-monthly">
              {t('plans.orYearly', { price: money(offer.prices.yearly) })}{' '}
              <span className="plan-pill">{t('plans.twoMonthsFree')}</span>
            </p>
          </>
        ) : (
          <p className="plan-price">
            <span className="plan-price-big">{t('plans.free')}</span>
          </p>
        )}
        {below ? (
          <p className="plan-plus">{t('plans.everythingIn', { plan: planName(below) })}</p>
        ) : (
          <p className="plan-plus">{t('plans.unlimitedMembers')}</p>
        )}
        {tier === 'essentials' && (
          <div className="plan-push">
            <p className="plan-push-title">
              <Icon path={BELL} />
              {t('plans.pushTitle')}
            </p>
            <p>{t('plans.pushBody')}</p>
          </div>
        )}
        <ul className="plan-modules">
          {offer.adds.map((type) => {
            const info = MODULES.find((m) => m.type === type);
            return info ? <li key={type}>{t(info.name)}</li> : null;
          })}
        </ul>
        {tier === 'basic' && <p className="muted plan-nopush">{t('plans.noPush')}</p>}
        <div className="plan-card-action">
          {confirming?.tier === tier ? (
            <div className="module-confirm">
              <p>{confirmText(tier, confirming.trial)}</p>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  autoFocus
                  disabled={!!pending}
                  onClick={() => {
                    setConfirming(null);
                    void run(tier, () => (confirming.trial ? startPlanTrial(poiId, tier) : choosePlan(poiId, tier)));
                  }}
                >
                  {t('plans.confirm')}
                </button>
                <button type="button" className="btn" onClick={() => setConfirming(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            planAction(tier)
          )}
        </div>
      </article>
    );
  }

  function moduleCard(info: ModuleInfo) {
    const row: ActiveModule | undefined = rowFor(info.type);
    const allowed = inPlan(info.type);
    const on = allowed && !!row && LIVE.has(row.status);
    const busy = pending === info.type;
    const style = { '--c': `var(--module-${info.hue})`, '--s': `var(--module-${info.hue}-soft)` } as CSSProperties;
    let pill: string;
    if (!allowed) pill = t('plans.inPlan', { plan: planName(planOf(info.type)) });
    else if (row?.offered && !billing!.comped) pill = t('plans.offeredModule');
    else pill = on ? t('plans.on') : t('plans.hidden');
    return (
      <article key={info.type} className={`module-card${on ? ' module-card-on' : ''}${allowed ? '' : ' module-card-locked'}`} style={style}>
        <div className="module-card-top">
          <span className="module-card-icon">
            <Icon path={info.icon} />
          </span>
          <span className={`module-card-pill${on ? ' module-card-pill-on' : ''}`}>{pill}</span>
        </div>
        <h3>{t(info.name)}</h3>
        <p className="module-card-desc">{t(info.description)}</p>
        <div className="module-card-actions">
          <button type="button" className="text-action module-card-more" onClick={() => setDetails(info)}>
            {t('plans.learnMore')}
          </button>
          {!allowed ? (
            !fixed && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {t('plans.switchTo', { plan: planName(planOf(info.type)) })}
              </button>
            )
          ) : on ? (
            <button type="button" className="btn" disabled={busy} onClick={() => run(info.type, () => stopModule(poiId, info.type))}>
              {t('plans.hide')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(info.type, () => startModule(poiId, info.type))}>
              {t('plans.show')}
            </button>
          )}
        </div>
      </article>
    );
  }

  const latest = billing.invoices[0];
  const lineName = (line: BillingSummary['invoices'][number]['lines'][number]) => {
    if (line.plan) return planName(line.plan);
    const info = MODULES.find((m) => m.type === line.moduleType);
    return info ? t(info.name) : '';
  };

  return (
    <div>
      <h2>{t('plans.title')}</h2>
      <p className="muted">{billing.comped ? t('plans.subtitleOffered') : t('plans.subtitle')}</p>

      {error && <p className="error-text">{error}</p>}

      {billing.trialEndsAt && !fixed && (
        <div className="card">
          <p className="module-alert">
            {t('plans.trialLeft', { plan: planName(plan), days: trialDays, date: date(billing.trialEndsAt) })}{' '}
            {billing.paymentMethod ? t('plans.trialThenPaid', { price: priceOf(plan) }) : t('plans.trialNeedsPayment')}
          </p>
        </div>
      )}

      {fixed ? (
        <div className="card">
          <p className="card-title">{t('plans.offeredTitle')}</p>
          <p className="muted" style={{ marginTop: 4 }}>
            {billing.comped ? t('plans.offeredBody') : t('plans.planOfferedBody', { plan: planName(plan) })}
          </p>
        </div>
      ) : (
        <div className="plan-grid" ref={plansRef}>
          {PLAN_ORDER.map(planCard)}
        </div>
      )}

      <h3 className="modules-heading">{t('plans.inYourPlan')}</h3>
      <p className="muted">{t('plans.inYourPlanHint')}</p>
      <div className="module-grid">{shown.filter((m) => inPlan(m.type)).map(moduleCard)}</div>

      {shown.some((m) => !inPlan(m.type)) && (
        <>
          <h3 className="modules-heading">{t('plans.withBigger')}</h3>
          <div className="module-grid">{shown.filter((m) => !inPlan(m.type)).map(moduleCard)}</div>
        </>
      )}

      {!fixed && (
        <div className="card modules-subscription" ref={paymentRef}>
          <p className="card-title">{t('plans.subscriptionTitle')}</p>
          <div className="billing-figures">
            <div>
              <p className="billing-figure">{planName(plan)}</p>
              <p className="muted">{t('plans.planLabel')}</p>
            </div>
            <div>
              <p className="billing-figure">{plan === 'basic' ? t('plans.free') : priceOf(billing.pendingPlan ?? plan)}</p>
              <p className="muted">{t('plans.priceLabel')}</p>
            </div>
            <div>
              <p className="billing-figure">
                {billing.renewsAt ? date(billing.renewsAt) : billing.trialEndsAt ? date(billing.trialEndsAt) : t('plans.nothingToPay')}
              </p>
              <p className="muted">{t('plans.nextCharge')}</p>
            </div>
          </div>

          <div className="form">
            <div className="form-row">
              <span className="form-label">{t('plans.intervalLabel')}</span>
              {(['yearly', 'monthly'] as BillingInterval[]).map((option) => (
                <label key={option} className="radio-row">
                  <input
                    type="radio"
                    name="billing-interval"
                    checked={interval === option}
                    disabled={pending === 'interval'}
                    onChange={() => run('interval', () => setBillingInterval(poiId, option))}
                  />
                  <span>
                    <strong>{t(option === 'yearly' ? 'plans.yearly' : 'plans.monthly')}</strong>
                    {option === 'yearly' && <span className="muted"> · {t('plans.yearlyHint')}</span>}
                  </span>
                </label>
              ))}
              {billing.renewsAt && <p className="muted module-desc">{t('plans.intervalNote')}</p>}
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
                        run('payment', () => setPaymentMethod(poiId, paymentKind, last4)).then((ok) => {
                          if (!ok) return;
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
                        {date(invoice.issuedAt)} · {money(invoice.amount)} · {invoice.lines.map(lineName).join(', ')}
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

      <ModuleDetails
        info={details}
        planLabel={details ? t('plans.inPlan', { plan: planName(planOf(details.type)) }) : ''}
        onClose={() => setDetails(null)}
      />
    </div>
  );

}

/** "En savoir plus": a module's screenshots and what it brings. */
function ModuleDetails({ info, planLabel, onClose }: { info: ModuleInfo | null; planLabel: string; onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (info && !dialog.open) dialog.showModal();
    if (!info && dialog.open) dialog.close();
  }, [info]);
  const style = info ? ({ '--c': `var(--module-${info.hue})`, '--s': `var(--module-${info.hue}-soft)` } as CSSProperties) : undefined;
  return (
    <dialog
      ref={dialogRef}
      className="module-sheet"
      aria-label={info ? t(info.name) : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={style}
    >
      {info && (
        <div className="module-sheet-body">
          <div className="module-sheet-head">
            <span className="module-card-icon module-card-icon-on">
              <Icon path={info.icon} />
            </span>
            <div>
              <h2>{t(info.name)}</h2>
              <p className="muted">{planLabel}</p>
            </div>
            <button type="button" className="btn module-sheet-close" onClick={onClose}>
              {t('plans.close')}
            </button>
          </div>
          <div className="module-sheet-shots">
            {(['app', 'admin'] as const).map((side) => (
              <img
                key={side}
                className={`module-shot module-shot-${side}`}
                src={`/modules/${info.type}-${side}.jpg`}
                alt=""
                onError={(e) => {
                  e.currentTarget.hidden = true;
                }}
              />
            ))}
          </div>
          <dl className="module-sheet-points">
            <dt>{t('plans.membersGet')}</dt>
            <dd>{t(info.members)}</dd>
            <dt>{t('plans.teamGets')}</dt>
            <dd>{t(info.team)}</dd>
          </dl>
        </div>
      )}
    </dialog>
  );
}
