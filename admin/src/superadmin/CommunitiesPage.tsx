import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createCommunity,
  listCommunities,
  type CommunityBilling,
  type CommunityRow,
  type NewAdmin,
} from '../api/superadmin';
import type { SupportedLanguage } from '../api/types';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { ago, dateFr, errorText, eur, explain } from './format';
import { PasswordReveal } from './PasswordReveal';

const BILLING_LABELS: Record<CommunityBilling, string> = {
  comped: 'Offerte',
  paying: 'Payante',
  trial: 'En essai',
  free: 'Gratuite',
  suspended: 'Suspendue',
};

const FILTERS: { key: CommunityBilling | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'paying', label: 'Payantes' },
  { key: 'trial', label: 'En essai' },
  { key: 'comped', label: 'Offertes' },
  { key: 'free', label: 'Gratuites' },
  { key: 'suspended', label: 'Suspendues' },
];

function BillingStatus({ row }: { row: Pick<CommunityRow, 'billing' | 'monthly' | 'nextTrialEnd'> }) {
  let text = BILLING_LABELS[row.billing];
  if (row.billing === 'paying') text += ` · ${eur(row.monthly)}/mois`;
  if (row.billing === 'trial' && row.nextTrialEnd) text += ` · fin ${dateFr(row.nextTrialEnd)}`;
  return <span className={`sa-status sa-status-${row.billing}`}>{text}</span>;
}

function CreateForm({ onCreated, onCancel }: { onCreated: (poiId: string, admin: NewAdmin) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('es');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [comped, setComped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createCommunity({
        name,
        city: city || undefined,
        postalCode: postalCode || undefined,
        language,
        adminEmail,
        adminFirstName: adminFirstName || undefined,
        billingComped: comped,
      });
      onCreated(created.poi.id, created.admin);
    } catch (err) {
      setError(explain(errorText(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sa-create-title">
      <h3 id="sa-create-title">Nouvelle communauté</h3>
      <div className="card form">
        <label>
          Nom
          <input id="sa-new-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </label>
        <label>
          Ville
          <input id="sa-new-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
        </label>
        <label>
          Code postal
          <input id="sa-new-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20} />
        </label>
        <label>
          Langue de la communauté
          <select id="sa-new-language" value={language} onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
            {SUPPORTED_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </label>
        <label>
          E-mail de l’admin
          <input id="sa-new-admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        </label>
        <label>
          Prénom de l’admin
          <input id="sa-new-admin-name" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} maxLength={100} />
        </label>
        <div className="form-row sa-switch-row">
          <span>
            Offerte
            <span className="muted sa-hint">Tous les modules gratuits, comme Carmen</span>
          </span>
          <input
            id="sa-new-comped"
            type="checkbox"
            role="switch"
            className="switch"
            checked={comped}
            onChange={(e) => setComped(e.target.checked)}
            aria-label="Offerte"
          />
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="card-actions sa-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Création…' : 'Créer la communauté'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Annuler
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

  const load = () =>
    listCommunities()
      .then(setRows)
      .catch((err) => setError(errorText(err)));

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
        <h2>Communautés</h2>
        {!creating && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Créer une communauté
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
          Communauté créée. {created.admin.email} avait déjà un compte : il ou elle en est maintenant admin avec son mot de passe
          habituel. <Link to={`../communities/${created.poiId}`}>Ouvrir la fiche</Link>
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
      {!rows && !error && <p className="muted">Chargement…</p>}
      {rows && (
        <>
          <div className="card form sa-search">
            <label>
              Rechercher
              <input
                id="sa-communities-search"
                type="search"
                placeholder="Nom, ville, code postal"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="chips" role="group" aria-label="Filtrer">
            {FILTERS.map((f) => {
              const count = f.key === 'all' ? rows.length : rows.filter((r) => r.billing === f.key).length;
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`chip${filter === f.key ? ' chip-selected' : ''}`}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>
          <div className="card sa-table-card">
            {shown.length === 0 ? (
              <p className="todo-done">Aucune communauté ici.</p>
            ) : (
              <div className="sa-table-scroll">
                <table className="data-table sa-table">
                  <thead>
                    <tr>
                      <th>Communauté</th>
                      <th>Membres</th>
                      <th>Modules</th>
                      <th>Facturation</th>
                      <th>Admin vu</th>
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
                          {row.offeredModules > 0 && <span className="sa-sub">{row.offeredModules} offert{row.offeredModules > 1 ? 's' : ''}</span>}
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
