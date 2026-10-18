import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJournal, type JournalEntry } from '../api/superadmin';
import { useSa, type Sa } from './format';

const FILTERS = [
  { key: '', label: 'journal.all' },
  { key: 'superadmin.', label: 'journal.superadmin' },
  { key: 'admin.login', label: 'journal.adminLogins' },
];

/** The action in words; an action this list does not know yet stays as it is. */
function actionLabel(action: string, { s }: Sa): string {
  const key = `journal.${action}`;
  const label = s(key);
  return label === key ? action : label;
}

function details(entry: JournalEntry, { s, moduleLabel }: Sa): string {
  const d = entry.details;
  const parts: string[] = [];
  if (typeof d.module === 'string') parts.push(moduleLabel(d.module));
  if (typeof d.email === 'string') parts.push(d.email);
  if (typeof d.adminEmail === 'string') parts.push(`admin ${d.adminEmail}`);
  if (Array.isArray(d.fields)) parts.push(s('journal.fields', { list: d.fields.join(', ') }));
  if (typeof d.method === 'string' && typeof d.path === 'string') parts.push(`${d.method} ${d.path}`);
  if (typeof d.name === 'string') parts.push(d.name);
  return parts.join(' · ');
}

export function SuperadminJournalPage() {
  const [filter, setFilter] = useState('');
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sa = useSa();
  const { s, dateTime, error: describe } = sa;

  useEffect(() => {
    getJournal({ action: filter || undefined })
      .then((rows) => {
        setEntries(rows);
        setMore(rows.length === 100);
      })
      .catch((err) => setError(describe(err)));
  }, [filter, describe]);

  function loadMore() {
    const last = entries?.[entries.length - 1];
    if (!last) return;
    getJournal({ action: filter || undefined, before: last.createdAt })
      .then((rows) => {
        setEntries((list) => [...(list ?? []), ...rows]);
        setMore(rows.length === 100);
      })
      .catch((err) => setError(describe(err)));
  }

  return (
    <div>
      <h2>{s('journal.title')}</h2>
      <p className="muted">{s('journal.intro')}</p>
      <div className="chips" role="group" aria-label={s('common.filter')}>
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
            {s(f.label)}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      {!entries && !error && <p className="muted">{s('common.loading')}</p>}
      {entries && (
        <div className="card card-list sa-gap">
          {entries.length === 0 && <p className="todo-done">{s('journal.none')}</p>}
          {entries.map((entry) => (
            <div className="card-row" key={entry.id}>
              <span>
                <span className={`card-title${entry.action.endsWith('.failed') ? ' sa-failed' : ''}`}>
                  {actionLabel(entry.action, sa)}
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
                <span className="sa-sub">{[entry.actorEmail, details(entry, sa), entry.ip].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="sa-sub sa-nowrap">{dateTime(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      {more && (
        <button type="button" className="btn sa-gap" onClick={loadMore}>
          {s('journal.older')}
        </button>
      )}
    </div>
  );
}
