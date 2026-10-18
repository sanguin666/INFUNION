import { useEffect, useState, type FormEvent } from 'react';
import { changeSuperadminPassword, getHealth, type Health } from '../api/superadmin';
import { useSa, type Sa } from './format';

const WARNINGS: Record<Health['warnings'][number], string> = {
  demoLogin: 'health.warnDemoLogin',
  initialPassword: 'health.warnInitialPassword',
  reset2fa: 'health.warnReset2fa',
  cors: 'health.warnCors',
};

function uptime(seconds: number, { s }: Sa): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return s('health.days', { d: days, h: hours });
  if (hours) return s('health.hours', { h: hours, m: minutes });
  return s('health.minutes', { m: minutes });
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { s, error: describe } = useSa();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await changeSuperadminPassword(current, next);
      setCurrent('');
      setNext('');
      setMessage({ ok: true, text: s('health.passwordChanged') });
    } catch (err) {
      setMessage({ ok: false, text: describe(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sa-password-title">
      <h3 id="sa-password-title">{s('health.passwordTitle')}</h3>
      <div className="card form">
        <label>
          {s('health.currentPassword')}
          <input id="sa-current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label>
          {s('health.newPassword')}
          <input id="sa-new-password" type="password" autoComplete="new-password" minLength={12} value={next} onChange={(e) => setNext(e.target.value)} required />
        </label>
      </div>
      {message && <p className={message.ok ? 'sa-notice' : 'error-text'}>{message.text}</p>}
      <div className="card-actions sa-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {s('health.changePassword')}
        </button>
      </div>
    </form>
  );
}

export function SuperadminHealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sa = useSa();
  const { s, dateTime, error: describe } = sa;

  const load = () =>
    getHealth()
      .then(setData)
      .catch((err) => setError(describe(err)));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="sa-heading">
        <h2>{s('health.title')}</h2>
        <button type="button" className="btn" onClick={load}>
          {s('health.refresh')}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!data && !error && <p className="muted">{s('common.loading')}</p>}
      {data && (
        <>
          {data.warnings.length > 0 && (
            <div className="card card-list sa-gap">
              {data.warnings.map((warning) => (
                <div className="card-row" key={warning}>
                  <span className="sa-warning">
                    <span className="sa-dot sa-dot-alert" aria-hidden="true" /> {s(WARNINGS[warning] ?? warning)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="kpi-row">
            <div className="stat-tile">
              <p className="stat-label">{s('health.server')}</p>
              <p className="stat-value">{s('health.online')}</p>
              <p className="stat-delta stat-delta-neutral">{s('health.uptime', { time: uptime(data.uptimeSeconds, sa), mb: data.memoryMb })}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{s('health.errors24')}</p>
              <p className="stat-value">{data.errors24h}</p>
              <p className={`stat-delta ${data.errors24h ? 'stat-delta-down' : 'stat-delta-up'}`}>
                {data.errors24h ? s('health.seeList') : s('health.allGood')}
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{s('health.database')}</p>
              <p className="stat-value">{data.database.latencyMs} ms</p>
              <p className="stat-delta stat-delta-neutral">{s('health.size', { mb: data.database.sizeMb })}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{s('health.devices')}</p>
              <p className="stat-value">{data.push.devices}</p>
              <p className="stat-delta stat-delta-neutral">{data.push.enabled ? s('health.sendsOn') : s('health.sendsOff')}</p>
            </div>
          </div>

          <div className="card card-list">
            <div className="card-row"><span>{s('health.environment')}</span><strong>{data.environment}</strong></div>
            <div className="card-row"><span>{s('health.version')}</span><strong>{data.version ? `${data.version}${data.branch ? ` (${data.branch})` : ''}` : s('health.unknownVersion')}</strong></div>
            <div className="card-row"><span>{s('health.startedAt')}</span><strong>{dateTime(data.startedAt)}</strong></div>
            <div className="card-row"><span>{s('health.demoLogin')}</span><strong>{data.demoLogin ? s('health.on') : s('health.off')}</strong></div>
            <div className="card-row"><span>{s('health.stripe')}</span><strong>{data.stripe ? s('health.connected') : s('health.demo')}</strong></div>
          </div>

          <h3>{s('health.recentErrors')}</h3>
          <div className="card card-list">
            {data.recentErrors.length === 0 && <p className="todo-done">{s('health.noErrors')}</p>}
            {data.recentErrors.map((e, i) => (
              <div className="card-row" key={i}>
                <span>
                  <span className="card-title sa-mono">
                    {e.method} {e.path}
                  </span>
                  <span className="sa-sub">{e.message}</span>
                </span>
                <span className="sa-sub">{dateTime(e.at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <PasswordForm />
    </div>
  );
}
