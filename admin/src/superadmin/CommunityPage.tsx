import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addAdmin,
  deleteCommunity,
  getCommunity,
  moduleAction,
  removeAdmin,
  resetAdminPassword,
  setSuspended,
  updateCommunity,
  type CommunityDetail,
  type ModuleAction,
} from '../api/superadmin';
import type { ActiveModule, ModuleType, SupportedLanguage } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { useSa, type Sa } from './format';
import { PasswordReveal } from './PasswordReveal';

const LIVE = new Set(['trial', 'active']);

function moduleState({ s, date }: Sa, row: ActiveModule | undefined, comped: boolean, free: boolean): string {
  if (!row || !LIVE.has(row.status)) {
    if (row?.status === 'expired') return s('community.statePaused');
    if (row?.status === 'cancelled') return s('community.stateStopped');
    return s('community.stateOff');
  }
  if (row.offered) return s('community.stateOffered');
  if (free) return s('community.stateFree');
  if (comped) return s('community.stateIncluded');
  if (row.status === 'trial') return s('community.stateTrial', { date: date(row.trialEndsAt) });
  if (row.cancelAtPeriodEnd) return s('community.stateStops', { date: date(row.paidUntil) });
  return s('community.statePaid', { date: date(row.paidUntil) });
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
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const sa = useSa();
  const { s, date, ago, money, moduleLabel, error: describe } = sa;

  function show(detail: CommunityDetail) {
    setData(detail);
    setName(detail.poi.name);
    setCity(detail.poi.city ?? '');
    setPostalCode(detail.poi.postalCode ?? '');
    setAddress(detail.poi.address ?? '');
    setLanguage(detail.poi.language);
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
  const isFree = (type: ModuleType) => billing.freeModules.includes(type);
  const act = (type: ModuleType, action: ModuleAction, done: string) =>
    run(`${type}:${action}`, () => moduleAction(id, type, action), done);

  function saveInfo(event: FormEvent) {
    event.preventDefault();
    run('info', () => updateCommunity(id, { name, city, postalCode, address, language }), s('community.saved'));
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
    const free = isFree(type);
    const pending = busy?.startsWith(`${type}:`) ?? false;
    const buttons = [];
    if (live && row.offered) {
      buttons.push(
        <DestructiveButton key="unoffer" quiet label={s('community.unoffer')} disabled={pending} onConfirm={() => act(type, 'unoffer', s('community.unofferedMsg', { module: moduleLabel(type) }))} />,
      );
    } else if (!free && !billing.comped) {
      buttons.push(
        <button key="offer" type="button" className="text-action" disabled={pending} onClick={() => act(type, 'offer', s('community.offeredMsg', { module: moduleLabel(type) }))}>
          {s('community.offer')}
        </button>,
      );
    }
    if (!free && !billing.comped && (!live || row.status === 'trial') && !row?.offered) {
      buttons.push(
        <button key="trial" type="button" className="text-action" disabled={pending} onClick={() => act(type, 'extend-trial', s('community.extendedMsg', { module: moduleLabel(type) }))}>
          {live ? s('community.plusMonth') : s('community.trialMonth')}
        </button>,
      );
    }
    if (!live && (free || billing.comped)) {
      buttons.push(
        <button key="start" type="button" className="text-action" disabled={pending} onClick={() => act(type, 'start', s('community.startedMsg', { module: moduleLabel(type) }))}>
          {s('community.activate')}
        </button>,
      );
    }
    if (live && !row.offered && !row.cancelAtPeriodEnd) {
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
            <span className="card-title">{s('community.compedRow')}</span>
            <span className="sa-sub">{s('community.compedHint')}</span>
          </span>
          <input
            id="sa-poi-comped"
            type="checkbox"
            role="switch"
            className="switch"
            checked={billing.comped}
            disabled={busy === 'comped'}
            onChange={(e) =>
              run('comped', () => updateCommunity(id, { billingComped: e.target.checked }), e.target.checked ? s('community.compedOn') : s('community.compedOff'))
            }
            aria-label={s('community.compedRow')}
          />
        </div>
        {data.allModules.map((type) => (
          <div className="card-row" key={type}>
            <span>
              <span className="card-title">{moduleLabel(type)}</span>
              <span className="sa-sub">{moduleState(sa, rowFor(type), billing.comped, isFree(type))}</span>
            </span>
            <span className="sa-row-actions">{moduleActions(type)}</span>
          </div>
        ))}
      </div>
      <p className="muted sa-hint">
        {billing.comped
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
                  <span className="sa-sub">{invoice.lines.map((line) => moduleLabel(line.moduleType)).join(', ')}</span>
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
