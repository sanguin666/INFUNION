import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addPlaceToAccount,
  deleteAccount,
  listCommunities,
  removePlaceFromAccount,
  searchAccounts,
  type Account,
  type CommunityRow,
} from '../api/superadmin';
import { DestructiveButton } from '../components/DestructiveButton';
import { useSa } from './format';
import { PasswordReveal } from './PasswordReveal';

/** Every account, members and admins, found by phone, email or name. */
export function SuperadminAccountsPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { s, date, ago, error: describe } = useSa();
  // "Places managed": one account opened at a time, the communities to
  // choose from loaded the first time.
  const [openId, setOpenId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<CommunityRow[] | null>(null);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

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

  function replace(account: Account) {
    setResults((list) => list?.map((a) => (a.id === account.id ? account : a)) ?? null);
  }

  function togglePlaces(account: Account) {
    setAdding('');
    setOpenId((id) => (id === account.id ? null : account.id));
    if (!communities) {
      listCommunities()
        .then((rows) => setCommunities([...rows].sort((a, b) => a.name.localeCompare(b.name))))
        .catch((err) => setError(describe(err)));
    }
  }

  async function changePlace(work: () => Promise<Account>, message: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      replace(await work());
      setNotice(message);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  function addPlace(account: Account) {
    const place = communities?.find((c) => c.id === adding);
    if (!place) return;
    void changePlace(async () => {
      const result = await addPlaceToAccount(account.id, place.id);
      setAdding('');
      if (result.admin.temporaryPassword) setReveal({ email: result.admin.email, password: result.admin.temporaryPassword });
      return result.account;
    }, s('accounts.placeAdded', { place: place.name }));
  }

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
                  {account.email && (
                    <button type="button" className="text-action" aria-expanded={openId === account.id} onClick={() => togglePlaces(account)}>
                      {s('accounts.managePlaces')}
                    </button>
                  )}
                  <DestructiveButton quiet label={s('accounts.delete')} onConfirm={() => remove(account)} />
                </span>
              )}
              {openId === account.id && account.email && (
                <div className="sa-places">
                  <span className="card-title">{s('accounts.places')}</span>
                  {account.communities.filter((c) => c.role === 'admin').length === 0 && (
                    <span className="sa-sub">{s('accounts.noPlaces')}</span>
                  )}
                  {account.communities
                    .filter((c) => c.role === 'admin')
                    .map((c) => (
                      <div className="sa-places-row" key={c.id}>
                        <Link to={`../communities/${c.id}`}>{c.name}</Link>
                        <DestructiveButton
                          quiet
                          label={s('community.remove')}
                          disabled={busy}
                          onConfirm={() =>
                            changePlace(() => removePlaceFromAccount(account.id, c.id), s('accounts.placeRemoved', { place: c.name }))
                          }
                        />
                      </div>
                    ))}
                  <div className="sa-places-add">
                    <select
                      id={`sa-add-place-${account.id}`}
                      aria-label={s('accounts.choosePlace')}
                      value={adding}
                      onChange={(e) => setAdding(e.target.value)}
                    >
                      <option value="">{communities ? s('accounts.choosePlace') : s('common.loading')}</option>
                      {communities
                        ?.filter((c) => !account.communities.some((m) => m.id === c.id && m.role === 'admin'))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <button type="button" className="btn btn-primary" disabled={!adding || busy} onClick={() => addPlace(account)}>
                      {s('accounts.addPlace')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {reveal && <PasswordReveal email={reveal.email} password={reveal.password} onClose={() => setReveal(null)} />}
      <p className="muted sa-hint">{s('accounts.note')}</p>
    </div>
  );
}
