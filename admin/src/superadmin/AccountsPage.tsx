import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteAccount, searchAccounts, type Account } from '../api/superadmin';
import { DestructiveButton } from '../components/DestructiveButton';
import { useSa } from './format';

/** Every account, members and admins, found by phone, email or name. */
export function SuperadminAccountsPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { s, date, ago, error: describe } = useSa();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      searchAccounts(q)
        .then((found) => {
          setResults(found);
          setError(null);
        })
        .catch((err) => setError(describe(err)));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, describe]);

  async function remove(account: Account) {
    setError(null);
    try {
      await deleteAccount(account.id);
      setResults((list) => list?.filter((a) => a.id !== account.id) ?? null);
      setNotice(s('accounts.deleted'));
    } catch (err) {
      setError(describe(err));
    }
  }

  return (
    <div>
      <h2>{s('accounts.title')}</h2>
      <p className="muted">{s('accounts.intro')}</p>
      <div className="card form">
        <label>
          {s('common.search')}
          <input
            id="sa-accounts-search"
            type="search"
            placeholder={s('accounts.placeholder')}
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
          {results.length === 0 && <p className="todo-done">{s('accounts.none')}</p>}
          {results.map((account) => (
            <div className="card-row sa-account" key={account.id}>
              <span>
                <span className="card-title">
                  {[account.firstName, account.lastName].filter(Boolean).join(' ') || account.email || account.phone}
                  {account.isSuperadmin && <span className="sa-status sa-status-comped"> · {s('accounts.superadmin')}</span>}
                </span>
                <span className="sa-sub">{[account.phone, account.email].filter(Boolean).join(' · ')}</span>
                <span className="sa-sub">
                  {s('accounts.created', { date: date(account.createdAt), when: ago(account.lastSeenAt) })}
                  {account.lastLoginAt && s('accounts.adminLogin', { when: ago(account.lastLoginAt) })}
                </span>
                <span className="sa-sub">
                  {account.communities.length === 0
                    ? s('accounts.noCommunity')
                    : account.communities.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && ', '}
                          <Link to={`../communities/${c.id}`}>{c.name}</Link>
                          {c.role === 'admin' ? s('accounts.adminTag') : ''}
                        </span>
                      ))}
                </span>
              </span>
              {!account.isSuperadmin && (
                <span className="sa-row-actions">
                  <DestructiveButton quiet label={s('accounts.delete')} onConfirm={() => remove(account)} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="muted sa-hint">{s('accounts.note')}</p>
    </div>
  );
}
