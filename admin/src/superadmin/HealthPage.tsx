import { useEffect, useState, type FormEvent } from 'react';
import { changeSuperadminPassword, getHealth, type Health } from '../api/superadmin';
import { dateTimeFr, errorText, explain } from './format';

function uptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days} j ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await changeSuperadminPassword(current, next);
      setCurrent('');
      setNext('');
      setMessage({ ok: true, text: 'Mot de passe changé.' });
    } catch (err) {
      setMessage({ ok: false, text: explain(errorText(err)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sa-password-title">
      <h3 id="sa-password-title">Mon mot de passe superadmin</h3>
      <div className="card form">
        <label>
          Mot de passe actuel
          <input id="sa-current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label>
          Nouveau mot de passe (12 caractères ou plus)
          <input id="sa-new-password" type="password" autoComplete="new-password" minLength={12} value={next} onChange={(e) => setNext(e.target.value)} required />
        </label>
      </div>
      {message && <p className={message.ok ? 'sa-notice' : 'error-text'}>{message.text}</p>}
      <div className="card-actions sa-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Changer le mot de passe
        </button>
      </div>
    </form>
  );
}

export function SuperadminHealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    getHealth()
      .then(setData)
      .catch((err) => setError(errorText(err)));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="sa-heading">
        <h2>Santé technique</h2>
        <button type="button" className="btn" onClick={load}>
          Actualiser
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!data && !error && <p className="muted">Chargement…</p>}
      {data && (
        <>
          {data.warnings.length > 0 && (
            <div className="card card-list sa-gap">
              {data.warnings.map((warning) => (
                <div className="card-row" key={warning}>
                  <span className="sa-warning">
                    <span className="sa-dot sa-dot-alert" aria-hidden="true" /> {warning}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="kpi-row">
            <div className="stat-tile">
              <p className="stat-label">Serveur</p>
              <p className="stat-value">En ligne</p>
              <p className="stat-delta stat-delta-neutral">depuis {uptime(data.uptimeSeconds)} · {data.memoryMb} Mo</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Erreurs sur 24 h</p>
              <p className="stat-value">{data.errors24h}</p>
              <p className={`stat-delta ${data.errors24h ? 'stat-delta-down' : 'stat-delta-up'}`}>
                {data.errors24h ? 'voir la liste plus bas' : 'tout va bien'}
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Base de données</p>
              <p className="stat-value">{data.database.latencyMs} ms</p>
              <p className="stat-delta stat-delta-neutral">{data.database.sizeMb} Mo</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Téléphones pour les notifications</p>
              <p className="stat-value">{data.push.devices}</p>
              <p className="stat-delta stat-delta-neutral">{data.push.enabled ? 'envois actifs' : 'envois coupés'}</p>
            </div>
          </div>

          <div className="card card-list">
            <div className="card-row"><span>Environnement</span><strong>{data.environment}</strong></div>
            <div className="card-row"><span>Version déployée</span><strong>{data.version ? `${data.version}${data.branch ? ` (${data.branch})` : ''}` : 'inconnue (hors Railway)'}</strong></div>
            <div className="card-row"><span>Démarré le</span><strong>{dateTimeFr(data.startedAt)}</strong></div>
            <div className="card-row"><span>Connexion démo</span><strong>{data.demoLogin ? 'active' : 'coupée'}</strong></div>
            <div className="card-row"><span>Paiement des dons (Stripe)</span><strong>{data.stripe ? 'branché' : 'démo'}</strong></div>
          </div>

          <h3>Dernières erreurs serveur</h3>
          <div className="card card-list">
            {data.recentErrors.length === 0 && <p className="todo-done">Aucune depuis le dernier démarrage.</p>}
            {data.recentErrors.map((e, i) => (
              <div className="card-row" key={i}>
                <span>
                  <span className="card-title sa-mono">
                    {e.method} {e.path}
                  </span>
                  <span className="sa-sub">{e.message}</span>
                </span>
                <span className="sa-sub">{dateTimeFr(e.at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <PasswordForm />
    </div>
  );
}
