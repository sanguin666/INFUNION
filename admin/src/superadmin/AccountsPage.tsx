import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteAccount, searchAccounts, type Account } from '../api/superadmin';
import { DestructiveButton } from '../components/DestructiveButton';
import { ago, dateFr, errorText, explain } from './format';

/** Every account, members and admins, found by phone, email or name. */
export function SuperadminAccountsPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      searchAccounts(q)
        .then((found) => {
          setResults(found);
          setError(null);
        })
        .catch((err) => setError(errorText(err)));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function remove(account: Account) {
    setError(null);
    try {
      await deleteAccount(account.id);
      setResults((list) => list?.filter((a) => a.id !== account.id) ?? null);
      setNotice('Compte supprimé.');
    } catch (err) {
      setError(explain(errorText(err)));
    }
  }

  return (
    <div>
      <h2>Utilisateurs</h2>
      <p className="muted">Membres et admins de toutes les communautés. Tapez au moins deux caractères.</p>
      <div className="card form">
        <label>
          Rechercher
          <input
            id="sa-accounts-search"
            type="search"
            placeholder="Téléphone, e-mail, prénom ou nom"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </label>
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {notice && <p className="sa-notice" role="status">{notice}</p>}
      {query.trim().length >= 2 && results && (
        <div className="card card-list sa-gap">
          {results.length === 0 && <p className="todo-done">Personne ne correspond.</p>}
          {results.map((account) => (
            <div className="card-row sa-account" key={account.id}>
              <span>
                <span className="card-title">
                  {[account.firstName, account.lastName].filter(Boolean).join(' ') || account.email || account.phone}
                  {account.isSuperadmin && <span className="sa-status sa-status-comped"> · superadmin</span>}
                </span>
                <span className="sa-sub">{[account.phone, account.email].filter(Boolean).join(' · ')}</span>
                <span className="sa-sub">
                  Compte créé le {dateFr(account.createdAt)} · vu {ago(account.lastSeenAt)}
                  {account.lastLoginAt && ` · connexion admin ${ago(account.lastLoginAt)}`}
                </span>
                <span className="sa-sub">
                  {account.communities.length === 0
                    ? 'Aucune communauté'
                    : account.communities.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && ', '}
                          <Link to={`../communities/${c.id}`}>{c.name}</Link>
                          {c.role === 'admin' ? ' (admin)' : ''}
                        </span>
                      ))}
                </span>
              </span>
              {!account.isSuperadmin && (
                <span className="sa-row-actions">
                  <DestructiveButton quiet label="Supprimer le compte" onConfirm={() => remove(account)} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="muted sa-hint">
        Supprimer un compte efface la personne, ses appartenances, ses demandes et ses appareils. Ses dons et intentions de messe
        restent dans les comptes des communautés.
      </p>
    </div>
  );
}
