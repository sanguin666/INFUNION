import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addAdmin,
  deleteCommunity,
  getCommunity,
  lookupAdmin,
  moduleAction,
  planAction,
  removeAdmin,
  resetAdminPassword,
  setSuspended,
  updateCommunity,
  type AdminLookup,
  type CommunityDetail,
  type ModuleAction,
  type PlanAction,
} from '../api/superadmin';
import type { BillingSummary, ModuleType, PlanTier, PoiType, SupportedLanguage } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { useI18n } from '../i18n/I18nContext';
import { PLACE_KINDS } from '../placeKinds';
import { useSa, type Sa } from './format';
import { PasswordReveal } from './PasswordReveal';

const LIVE = new Set(['trial', 'active']);

const PLANS: PlanTier[] = ['basic', 'essentials', 'complete'];

function planState({ s, date, planLabel }: Sa, billing: BillingSummary): string {
  if (billing.comped) return s('community.compedHint');
  const plan = planLabel(billing.plan);
  if (billing.planOffered) return s('community.planOffered', { plan });
  if (billing.trialEndsAt) return s('community.planTrial', { plan, date: date(billing.trialEndsAt) });
  if (billing.plan === 'basic') return s('community.planFree');
  const pending = billing.pendingPlan ? s('community.planPending', { plan: planLabel(billing.pendingPlan) }) : '';
  return s('community.planPaid', { plan, date: date(billing.renewsAt) }) + pending;
}

export function SuperadminCommunityPage() {
  const { poiId } = useParams<{ poiId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CommunityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('es');
  const [kind, setKind] = useState<PoiType>('church');
  const { t } = useI18n();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const sa = useSa();
  const { s, date, ago, money, moduleLabel, planLabel, error: describe } = sa;

  // As the email is typed: is it someone who already runs other places?
  // They keep their password, so the superadmin knows not to send one.
  const [existing, setExisting] = useState<{ email: string; found: AdminLookup } | null>(null);
  useEffect(() => {
    const email = adminEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const timer = window.setTimeout(() => {
      lookupAdmin(email)
        .then((found) => setExisting({ email, found }))
        .catch(() => setExisting(null));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [adminEmail]);
  const known = existing && existing.email === adminEmail.trim() && existing.found.exists ? existing.found : null;

  function show(detail: CommunityDetail) {
    setData(detail);
    setName(detail.poi.name);
    setCity(detail.poi.city ?? '');
    setPostalCode(detail.poi.postalCode ?? '');
    setAddress(detail.poi.address ?? '');
    setLanguage(detail.poi.language);
    setKind(detail.poi.type);
  }

  useEffect(() => {
    if (!poiId) return;
    getCommunity(poiId)
      .then(show)
      .catch((err) => setError(describe(err)));
  }, [poiId, describe]);

  async function run(key: string, action: () => Promise<CommunityDetail | void>, done?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result) show(result);
      if (done) setNotice(done);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div>
        <Link to="..">{s('community.back')}</Link>
        {error ? <p className="error-text">{error}</p> : <p className="muted">{s('common.loading')}</p>}
      </div>
    );
  }

  const { poi, billing } = data;
  const id = poi.id;
  const rowFor = (type: ModuleType) => billing.modules.find((m) => m.moduleType === type);
  const planOf = (type: ModuleType) => billing.plans.find((p) => p.adds.includes(type))?.tier ?? 'complete';
  const allowed = (type: ModuleType) =>
    !!rowFor(type)?.offered || PLANS.indexOf(planOf(type)) <= PLANS.indexOf(billing.plan);
  const act = (type: ModuleType, action: ModuleAction, done: string) =>
    run(`${type}:${action}`, () => moduleAction(id, type, action), done);
  const actPlan = (action: PlanAction, done: string, tier?: PlanTier) =>
    run(`plan:${action}:${tier ?? ''}`, () => planAction(id, action, tier), done);

  function moduleState(type: ModuleType): string {
    const row = rowFor(type);
    if (row?.offered) return s('community.stateOffered');
    if (!allowed(type)) return s('community.notInPlan');
    if (row && LIVE.has(row.status)) return t('plans.on');
    return row ? s('community.stateStopped') : s('community.stateOff');
  }

  function planActions() {
    if (billing.comped) return [];
    const pending = busy?.startsWith('plan:') ?? false;
    const buttons = [];
    // infunion offers a whole plan, never single modules (Seb, 30 Oct 2026).
    for (const tier of ['essentials', 'complete'] as PlanTier[]) {
      if (billing.planOffered && billing.plan === tier) continue;
      buttons.push(
        <button key={`offer-${tier}`} type="button" className="text-action" disabled={pending} onClick={() => actPlan('offer', s('community.planOfferedMsg', { plan: planLabel(tier) }), tier)}>
          {s('community.offerPlan', { plan: planLabel(tier) })}
        </button>,
      );
    }
    if (billing.planOffered) {
      buttons.push(
        <DestructiveButton key="unoffer" quiet label={s('community.takePlanBack')} disabled={pending} onConfirm={() => actPlan('unoffer', s('community.planUnofferedMsg'))} />,
      );
    } else if (billing.trialEndsAt || billing.plan === 'basic') {
      buttons.push(
        <button key="trial" type="button" className="text-action" disabled={pending} onClick={() => actPlan('extend-trial', s('community.planExtendedMsg'), 'complete')}>
          {billing.trialEndsAt ? s('community.plusMonth') : s('community.planTrialStart', { plan: planLabel('complete') })}
        </button>,
      );
    }
    return buttons;
  }

  function saveInfo(event: FormEvent) {
    event.preventDefault();
    run('info', () => updateCommunity(id, { name, type: kind, city, postalCode, address, language }), s('community.saved'));
  }

  function submitAdmin(event: FormEvent) {
    event.preventDefault();
    run('admin', async () => {
      const result = await addAdmin(id, adminEmail, adminFirstName || undefined);
      setAdminEmail('');
      setAdminFirstName('');
      if (result.admin.temporaryPassword) setReveal({ email: result.admin.email, password: result.admin.temporaryPassword });
      return result.community;
    }, s('community.adminAdded'));
  }

  function moduleActions(type: ModuleType) {
    const row = rowFor(type);
    const live = !!row && LIVE.has(row.status);
    const pending = busy?.startsWith(`${type}:`) ?? false;
    const buttons = [];
    if (row?.offered) {
      buttons.push(
        <DestructiveButton key="unoffer" quiet label={s('community.unoffer')} disabled={pending} onConfirm={() => act(type, 'unoffer', s('community.unofferedMsg', { module: moduleLabel(type) }))} />,
      );
    }
    if (!live && allowed(type)) {
      buttons.push(
        <button key="start" type="button" className="text-action" disabled={pending} onClick={() => act(type, 'start', s('community.startedMsg', { module: moduleLabel(type) }))}>
          {s('community.activate')}
        </button>,
      );
    }
    if (live && !row.offered) {
      buttons.push(
        <DestructiveButton key="stop" quiet label={s('community.stop')} disabled={pending} onConfirm={() => act(type, 'stop', s('community.stoppedMsg', { module: moduleLabel(type) }))} />,
      );
    }
    return buttons;
  }

  return (
    <div className="sa-detail">
      <Link to="..">{s('community.back')}</Link>
      <div className="sa-heading">
        <h2>{poi.name}</h2>
        <button type="button" className="btn" onClick={() => navigate(`/poi/${id}/dashboard`)}>
          {s('community.openAdmin')}
        </button>
      </div>
      <p className="muted">
        {s('community.meta', { n: data.memberCount, date: date(poi.createdAt), qr: poi.qrCodeToken })}
        {poi.suspendedAt && (
          <strong className="sa-status sa-status-suspended"> · {s('community.suspendedSince', { date: date(poi.suspendedAt) })}</strong>
        )}
      </p>

      {error && <p className="error-text" role="alert">{error}</p>}
      {notice && <p className="sa-notice" role="status">{notice}</p>}
      {reveal && <PasswordReveal email={reveal.email} password={reveal.password} onClose={() => setReveal(null)} />}

      <h3>{s('community.details')}</h3>
      <form onSubmit={saveInfo}>
        <div className="card form">
          <label>
            {s('communities.name')}
            <input id="sa-poi-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </label>
          <label>
            {s('community.address')}
            <input id="sa-poi-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
          </label>
          <label>
            {s('communities.postalCode')}
            <input id="sa-poi-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20} />
          </label>
          <label>
            {s('communities.city')}
            <input id="sa-poi-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
          </label>
          <label>
            {s('communities.kind')}
            <select id="sa-poi-kind" value={kind} onChange={(e) => setKind(e.target.value as PoiType)}>
              {PLACE_KINDS.map((option) => (
                <option key={option} value={option}>
                  {t(`location.kind_${option}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {s('communities.language')}
            <select id="sa-poi-language" value={language} onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_NAMES[code]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="card-actions sa-actions">
          <button type="submit" className="btn btn-primary" disabled={busy === 'info'}>
            {s('common.save')}
          </button>
        </div>
      </form>

      <h3>{s('community.modules')}</h3>
      <div className="card card-list">
        <div className="card-row">
          <span>
            <span className="card-title">{s('community.planTitle')}</span>
            <span className="sa-sub">{planState(sa, billing)}</span>
          </span>
          <span className="sa-row-actions">{planActions()}</span>
        </div>
        {data.allModules.map((type) => (
          <div className="card-row" key={type}>
            <span>
              <span className="card-title">{moduleLabel(type)}</span>
              <span className="sa-sub">{moduleState(type)}</span>
            </span>
            <span className="sa-row-actions">{moduleActions(type)}</span>
          </div>
        ))}
      </div>
      <p className="muted sa-hint">
        {billing.comped || billing.planOffered
          ? s('community.nothingBilled')
          : s('community.payment', {
              method: billing.paymentMethod ?? s('community.noMethod'),
              interval: billing.interval === 'yearly' ? s('community.yearly') : s('community.monthly'),
            }) + (billing.renewsAt ? s('community.nextDue', { date: date(billing.renewsAt) }) : '')}
      </p>

      {billing.invoices.length > 0 && (
        <>
          <h3>{s('community.invoices')}</h3>
          <div className="card card-list">
            {billing.invoices.map((invoice) => (
              <div className="card-row" key={invoice.id}>
                <span>
                  <span className="card-title">{date(invoice.issuedAt)}</span>
                  <span className="sa-sub">{invoice.lines.map((line) => (line.plan ? planLabel(line.plan) : moduleLabel(line.moduleType ?? ''))).join(', ')}</span>
                </span>
                <strong>{money(invoice.amount)}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>{s('community.admins')}</h3>
      <div className="card card-list">
        {data.admins.length === 0 && <p className="todo-done">{s('community.noAdmins')}</p>}
        {data.admins.map((admin) => (
          <div className="card-row" key={admin.id}>
            <span>
              <span className="card-title">{[admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email}</span>
              <span className="sa-sub">
                {s('community.lastLogin', { email: admin.email ?? '', when: ago(admin.lastLoginAt) })}
              </span>
              {admin.otherPlaces.length > 0 && (
                <span className="sa-sub">
                  {s('community.alsoManages')}
                  {admin.otherPlaces.map((place, i) => (
                    <span key={place.id}>
                      {i > 0 && ', '}
                      <Link to={`../communities/${place.id}`}>{place.name}</Link>
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="sa-row-actions">
              <DestructiveButton
                quiet
                label={s('community.newPassword')}
                disabled={busy === `admin:${admin.id}`}
                onConfirm={() =>
                  run(`admin:${admin.id}`, async () => {
                    const reset = await resetAdminPassword(id, admin.id);
                    setReveal({ email: reset.email, password: reset.temporaryPassword });
                  })
                }
              />
              <DestructiveButton
                quiet
                label={s('community.remove')}
                disabled={busy === `admin:${admin.id}`}
                onConfirm={() => run(`admin:${admin.id}`, () => removeAdmin(id, admin.id), s('community.adminRemoved'))}
              />
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={submitAdmin} aria-label={s('community.addAdmin')}>
        <div className="card form sa-gap">
          <label>
            {s('community.newAdminEmail')}
            <input id="sa-add-admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </label>
          <label>
            {s('community.firstName')}
            <input id="sa-add-admin-name" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} maxLength={100} />
          </label>
        </div>
        {known && (
          <p className="sa-known" role="status">
            <strong>
              {s('community.existingAccount', {
                name: [known.firstName, known.lastName].filter(Boolean).join(' ') || adminEmail.trim(),
              })}
            </strong>{' '}
            {known.places.some((p) => p.id === id)
              ? s('errors.already_admin')
              : known.places.length
              ? s('community.existingPlaces', { places: known.places.map((p) => p.name).join(', ') })
              : s('community.existingNoPlace')}
          </p>
        )}
        <div className="card-actions sa-actions">
          <button type="submit" className="btn btn-primary" disabled={busy === 'admin'}>
            {s('community.addAdmin')}
          </button>
        </div>
      </form>

      <h3>{s('community.danger')}</h3>
      <div className="card card-list">
        <div className="card-row">
          <span>
            <span className="card-title">{poi.suspendedAt ? s('community.reactivate') : s('community.suspend')}</span>
            <span className="sa-sub">{s('community.suspendHint')}</span>
          </span>
          {poi.suspendedAt ? (
            <button type="button" className="btn btn-primary" disabled={busy === 'suspend'} onClick={() => run('suspend', () => setSuspended(id, false), s('community.reactivatedMsg'))}>
              {s('community.reactivate')}
            </button>
          ) : (
            <DestructiveButton label={s('community.suspend')} disabled={busy === 'suspend'} onConfirm={() => run('suspend', () => setSuspended(id, true), s('community.suspendedMsg'))} />
          )}
        </div>
        <div className="card-row sa-delete-row">
          <span>
            <span className="card-title">{s('community.deleteTitle')}</span>
            <span className="sa-sub">{s('community.deleteHint', { name: poi.name })}</span>
            <input
              id="sa-delete-confirm"
              className="sa-inline-input"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={poi.name}
              aria-label={s('community.deleteAria')}
            />
          </span>
          <DestructiveButton
            label={s('community.delete')}
            disabled={confirmName.trim() !== poi.name.trim() || busy === 'delete'}
            onConfirm={() =>
              run('delete', async () => {
                await deleteCommunity(id, confirmName);
                navigate('..', { replace: true });
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
