import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRegistrations, type RegistrationFilter, type RegistrationRow } from '../api/superadmin';
import { useI18n } from '../i18n/I18nContext';
import { useSa } from './format';

const FILTERS: RegistrationFilter[] = ['open', 'approved', 'declined', 'withdrawn', 'all'];

/** Places that registered from the landing (Seb, 30 Oct 2026), oldest waiting first. */
export function SuperadminRegistrationsPage() {
  const [filter, setFilter] = useState<RegistrationFilter>('open');
  const [rows, setRows] = useState<RegistrationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { s, ago, planLabel, error: describe } = useSa();
  const { t } = useI18n();

  useEffect(() => {
    setRows(null);
    listRegistrations(filter)
      .then(setRows)
      .catch((err) => setError(describe(err)));
  }, [filter]);

  function checksText(row: RegistrationRow): { text: string; level: 'ok' | 'warn' } {
    if (row.status === 'approved') return { text: s('registrations.approved'), level: 'ok' };
    if (row.status === 'declined') return { text: s('registrations.declined'), level: 'warn' };
    if (row.status === 'withdrawn') return { text: s('registrations.withdrawn'), level: row.poiId ? 'warn' : 'ok' };
    if (row.status === 'question') return { text: s('registrations.question'), level: 'warn' };
    return row.warnings ? { text: s('registrations.warnings', { n: row.warnings }), level: 'warn' } : { text: s('registrations.allClear'), level: 'ok' };
  }

  return (
    <div>
      <div className="sa-heading">
        <h2>{s('registrations.title')}</h2>
      </div>
      <p className="muted">{s('registrations.intro')}</p>

      <div className="chips" role="group" aria-label={s('common.filter')}>
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip${filter === key ? ' chip-selected' : ''}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {s(`registrations.${key}`)}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {!rows && !error && <p className="muted">{s('common.loading')}</p>}
      {rows && (
        <div className="card sa-table-card">
          {rows.length === 0 ? (
            <p className="todo-done">{s('registrations.none')}</p>
          ) : (
            <div className="sa-table-scroll">
              <table className="data-table sa-table">
                <thead>
                  <tr>
                    <th>{s('registrations.colPlace')}</th>
                    <th>{s('registrations.colKind')}</th>
                    <th>{s('registrations.colPlan')}</th>
                    <th>{s('registrations.colApplicant')}</th>
                    <th>{s('registrations.colReceived')}</th>
                    <th>{s('registrations.colChecks')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const state = checksText(row);
                    return (
                      <tr key={row.id}>
                        <td>
                          <Link to={row.id} className="sa-row-link">
                            {row.placeName}
                          </Link>
                          <span className="sa-sub">{row.claim ? s('registrations.claim') : row.city}</span>
                        </td>
                        <td>{t(`location.kind_${row.type}`)}</td>
                        <td>{planLabel(row.plan)}</td>
                        <td>
                          {row.firstName} {row.lastName}
                          <span className="sa-sub">{row.email}</span>
                        </td>
                        <td className="sa-nowrap">{ago(row.createdAt)}</td>
                        <td>
                          <span className={`sa-status ${state.level === 'ok' ? 'sa-status-paying' : 'sa-status-trial'}`}>{state.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
