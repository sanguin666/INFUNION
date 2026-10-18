import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createCommunity,
  listCommunities,
  type CommunityBilling,
  type CommunityRow,
  type NewAdmin,
} from '../api/superadmin';
import type { PoiType, SupportedLanguage } from '../api/types';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { useI18n } from '../i18n/I18nContext';
import { PLACE_KINDS } from '../placeKinds';
import { useSa } from './format';
import { PasswordReveal } from './PasswordReveal';

const FILTERS: (CommunityBilling | 'all')[] = ['all', 'paying', 'trial', 'comped', 'free', 'suspended'];

function BillingStatus({ row }: { row: Pick<CommunityRow, 'billing' | 'monthly' | 'nextTrialEnd'> }) {
  const { s, money, date } = useSa();
  let text = s(`communities.${row.billing}`);
  if (row.billing === 'paying') text += ` · ${s('common.perMonth', { amount: money(row.monthly) })}`;
  if (row.billing === 'trial' && row.nextTrialEnd) text += ` · ${s('communities.trialEnd', { date: date(row.nextTrialEnd) })}`;
  return <span className={`sa-status sa-status-${row.billing}`}>{text}</span>;
}

function CreateForm({ onCreated, onCancel }: { onCreated: (poiId: string, admin: NewAdmin) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('es');
  const [kind, setKind] = useState<PoiType>('church');
  const { t } = useI18n();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [comped, setComped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { s, error: describe } = useSa();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createCommunity({
        name,
        city: city || undefined,
        postalCode: postalCode || undefined,
        type: kind,
        language,
        adminEmail,
        adminFirstName: adminFirstName || undefined,
        billingComped: comped,
      });
      onCreated(created.poi.id, created.admin);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sa-create-title">
      <h3 id="sa-create-title">{s('communities.newTitle')}</h3>
      <div className="card form">
        <label>
          {s('communities.name')}
          <input id="sa-new-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </label>
        <label>
          {s('communities.city')}
          <input id="sa-new-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
        </label>
        <label>
          {s('communities.postalCode')}
          <input id="sa-new-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20} />
        </label>
        <label>
          {s('communities.kind')}
          <select id="sa-new-kind" value={kind} onChange={(e) => setKind(e.target.value as PoiType)}>
            {PLACE_KINDS.map((option) => (
              <option key={option} value={option}>
                {t(`location.kind_${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {s('communities.language')}
          <select id="sa-new-language" value={language} onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
            {SUPPORTED_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {s('communities.adminEmail')}
          <input id="sa-new-admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        </label>
        <label>
          {s('communities.adminFirstName')}
          <input id="sa-new-admin-name" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} maxLength={100} />
        </label>
        <div className="form-row sa-switch-row">
          <span>
            {s('communities.comped')}
            <span className="muted sa-hint">{s('communities.compedHint')}</span>
          </span>
          <input
            id="sa-new-comped"
            type="checkbox"
            role="switch"
            className="switch"
            checked={comped}
            onChange={(e) => setComped(e.target.checked)}
            aria-label={s('communities.comped')}
          />
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="card-actions sa-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? s('communities.creating') : s('communities.submit')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {s('common.cancel')}
        </button>
      </div>
    </form>
  );
}

export function SuperadminCommunitiesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CommunityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CommunityBilling | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ poiId: string; admin: NewAdmin } | null>(null);
  const { s, ago, error: describe } = useSa();

  const load = () =>
    listCommunities()
      .then(setRows)
      .catch((err) => setError(describe(err)));

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (row) =>
        (filter === 'all' || row.billing === filter) &&
        (!q || [row.name, row.city, row.postalCode].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [rows, search, filter]);

  return (
    <div>
      <div className="sa-heading">
        <h2>{s('communities.title')}</h2>
        {!creating && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {s('communities.create')}
          </button>
        )}
      </div>

      {created && created.admin.temporaryPassword && (
        <PasswordReveal
          email={created.admin.email}
          password={created.admin.temporaryPassword}
          onClose={() => navigate(`../communities/${created.poiId}`)}
        />
      )}
      {created && !created.admin.temporaryPassword && (
        <p className="muted">
          {s('communities.existingAdmin', { email: created.admin.email })}{' '}
          <Link to={`../communities/${created.poiId}`}>{s('communities.openPage')}</Link>
        </p>
      )}

      {creating && (
        <CreateForm
          onCancel={() => setCreating(false)}
          onCreated={(poiId, admin) => {
            setCreating(false);
            setCreated({ poiId, admin });
            load();
          }}
        />
      )}

      {error && <p className="error-text">{error}</p>}
      {!rows && !error && <p className="muted">{s('common.loading')}</p>}
      {rows && (
        <>
          <div className="card form sa-search">
            <label>
              {s('common.search')}
              <input
                id="sa-communities-search"
                type="search"
                placeholder={s('communities.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="chips" role="group" aria-label={s('common.filter')}>
            {FILTERS.map((key) => {
              const count = key === 'all' ? rows.length : rows.filter((r) => r.billing === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  className={`chip${filter === key ? ' chip-selected' : ''}`}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {s(`communities.${key}`)} ({count})
                </button>
              );
            })}
          </div>
          <div className="card sa-table-card">
            {shown.length === 0 ? (
              <p className="todo-done">{s('communities.none')}</p>
            ) : (
              <div className="sa-table-scroll">
                <table className="data-table sa-table">
                  <thead>
                    <tr>
                      <th>{s('communities.colCommunity')}</th>
                      <th>{s('communities.colMembers')}</th>
                      <th>{s('communities.colModules')}</th>
                      <th>{s('communities.colBilling')}</th>
                      <th>{s('communities.colAdminSeen')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link to={row.id} className="sa-row-link">
                            {row.name}
                          </Link>
                          <span className="sa-sub">{[row.postalCode, row.city].filter(Boolean).join(' ') || '—'}</span>
                        </td>
                        <td>{row.members}</td>
                        <td>
                          {row.liveModules} / {row.totalModules}
                          {row.offeredModules > 0 && <span className="sa-sub">{s('communities.offeredCount', { n: row.offeredModules })}</span>}
                        </td>
                        <td>
                          <BillingStatus row={row} />
                        </td>
                        <td>{ago(row.lastAdminLoginAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
