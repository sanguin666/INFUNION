import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJournal, type JournalEntry } from '../api/superadmin';
import { dateTimeFr, errorText, moduleLabel } from './format';

const ACTIONS: Record<string, string> = {
  'admin.login': 'Connexion admin',
  'admin.login.failed': 'Connexion admin refusée',
  'superadmin.login': 'Entrée superadmin',
  'superadmin.login.failed': 'Code superadmin refusé',
  'superadmin.2fa.enrolled': 'Application d’authentification activée',
  'superadmin.2fa.enroll.failed': 'Activation refusée (mot de passe)',
  'superadmin.2fa.reset': 'Application d’authentification oubliée',
  'superadmin.password.changed': 'Mot de passe superadmin changé',
  'superadmin.poi.create': 'Communauté créée',
  'superadmin.poi.update': 'Communauté modifiée',
  'superadmin.poi.suspend': 'Communauté suspendue',
  'superadmin.poi.unsuspend': 'Communauté réactivée',
  'superadmin.poi.delete': 'Communauté supprimée',
  'superadmin.module.start': 'Module activé',
  'superadmin.module.stop': 'Module arrêté',
  'superadmin.module.offer': 'Module offert',
  'superadmin.module.unoffer': 'Offre reprise',
  'superadmin.module.extend-trial': 'Essai prolongé',
  'superadmin.admin.add': 'Admin ajouté',
  'superadmin.admin.remove': 'Admin retiré',
  'superadmin.admin.password_reset': 'Mot de passe admin renouvelé',
  'superadmin.user.delete': 'Compte supprimé',
  'superadmin.poi_admin.write': 'Changement dans l’admin d’une communauté',
};

const FILTERS = [
  { key: '', label: 'Tout' },
  { key: 'superadmin.', label: 'Superadmin' },
  { key: 'admin.login', label: 'Connexions admin' },
];

function describe(entry: JournalEntry): string {
  const d = entry.details;
  const parts: string[] = [];
  if (typeof d.module === 'string') parts.push(moduleLabel(d.module));
  if (typeof d.email === 'string') parts.push(d.email);
  if (typeof d.adminEmail === 'string') parts.push(`admin ${d.adminEmail}`);
  if (Array.isArray(d.fields)) parts.push(`champs : ${d.fields.join(', ')}`);
  if (typeof d.method === 'string' && typeof d.path === 'string') parts.push(`${d.method} ${d.path}`);
  if (typeof d.name === 'string') parts.push(d.name);
  return parts.join(' · ');
}

export function SuperadminJournalPage() {
  const [filter, setFilter] = useState('');
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJournal({ action: filter || undefined })
      .then((rows) => {
        setEntries(rows);
        setMore(rows.length === 100);
      })
      .catch((err) => setError(errorText(err)));
  }, [filter]);

  function loadMore() {
    const last = entries?.[entries.length - 1];
    if (!last) return;
    getJournal({ action: filter || undefined, before: last.createdAt })
      .then((rows) => {
        setEntries((list) => [...(list ?? []), ...rows]);
        setMore(rows.length === 100);
      })
      .catch((err) => setError(errorText(err)));
  }

  return (
    <div>
      <h2>Journal</h2>
      <p className="muted">Qui a fait quoi, et d’où : vos actions, les connexions des admins, et vos changements dans l’admin d’une communauté.</p>
      <div className="chips" role="group" aria-label="Filtrer">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip${filter === f.key ? ' chip-selected' : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => {
              if (f.key === filter) return;
              setEntries(null);
              setFilter(f.key);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      {!entries && !error && <p className="muted">Chargement…</p>}
      {entries && (
        <div className="card card-list sa-gap">
          {entries.length === 0 && <p className="todo-done">Rien pour l’instant.</p>}
          {entries.map((entry) => (
            <div className="card-row" key={entry.id}>
              <span>
                <span className={`card-title${entry.action.endsWith('.failed') ? ' sa-failed' : ''}`}>
                  {ACTIONS[entry.action] ?? entry.action}
                  {entry.poiName &&
                    (entry.poiId && entry.action !== 'superadmin.poi.delete' ? (
                      <>
                        {' · '}
                        <Link to={`../communities/${entry.poiId}`}>{entry.poiName}</Link>
                      </>
                    ) : (
                      ` · ${entry.poiName}`
                    ))}
                </span>
                <span className="sa-sub">{[entry.actorEmail, describe(entry), entry.ip].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="sa-sub sa-nowrap">{dateTimeFr(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      {more && (
        <button type="button" className="btn sa-gap" onClick={loadMore}>
          Plus ancien
        </button>
      )}
    </div>
  );
}
