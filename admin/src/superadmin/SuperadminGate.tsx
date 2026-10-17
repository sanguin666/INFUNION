import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { getSuperadminSession, setSuperadminSession } from '../api/client';
import {
  SUPERADMIN_EXPIRED_EVENT,
  confirmEnrollment,
  getSuperadminStatus,
  startEnrollment,
  verifyCode,
  type SuperadminStatus,
} from '../api/superadmin';
import { errorText, explain } from './format';

/**
 * The second lock on the superadmin section: the six-digit code from an
 * authenticator app, asked again every hour. The first time, it sets the
 * app up (password again, then a QR code to scan, then a first code).
 */
export function SuperadminGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => !!getSuperadminSession());
  const [status, setStatus] = useState<SuperadminStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lock = () => setUnlocked(false);
    window.addEventListener(SUPERADMIN_EXPIRED_EVENT, lock);
    // The hour runs out while the page sits open: lock it then, not at
    // the next click.
    const timer = window.setInterval(() => {
      if (!getSuperadminSession()) setUnlocked(false);
    }, 30_000);
    return () => {
      window.removeEventListener(SUPERADMIN_EXPIRED_EVENT, lock);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (unlocked) return;
    getSuperadminStatus()
      .then(setStatus)
      .catch((err) => setError(errorText(err)));
  }, [unlocked]);

  if (unlocked) return <>{children}</>;
  if (error) return <GateFrame><p className="error-text">{error}</p></GateFrame>;
  if (!status) return <GateFrame><p className="muted">Chargement…</p></GateFrame>;
  return status.enrolled ? (
    <CodeStep onDone={() => setUnlocked(true)} />
  ) : (
    <EnrollStep email={status.email} onDone={() => setUnlocked(true)} />
  );
}

function GateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="sa-gate">
      <h2>Superadmin</h2>
      {children}
    </div>
  );
}

function CodeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label>
      Code à 6 chiffres
      <input
        id="superadmin-code"
        className="sa-code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        autoFocus
        required
      />
    </label>
  );
}

function CodeStep({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSuperadminSession(await verifyCode(code));
      onDone();
    } catch (err) {
      setError(explain(errorText(err)));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GateFrame>
      <p className="muted">Ouvrez votre application d’authentification et tapez le code ANSAE Superadmin. La session dure une heure.</p>
      <form onSubmit={submit} className="sa-gate-form">
        <div className="card form">
          <CodeField value={code} onChange={setCode} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
          {busy ? 'Vérification…' : 'Entrer'}
        </button>
      </form>
    </GateFrame>
  );
}

function EnrollStep({ email, onDone }: { email: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function begin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const started = await startEnrollment(password);
      setPassword('');
      setSecret({ secret: started.secret, qr: await QRCode.toDataURL(started.otpauthUrl, { margin: 1, width: 220 }) });
    } catch (err) {
      setError(explain(errorText(err)));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSuperadminSession(await confirmEnrollment(code));
      onDone();
    } catch (err) {
      setError(explain(errorText(err)));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (!secret) {
    return (
      <GateFrame>
        <p className="muted">
          Première ouverture pour {email}. Le superadmin se protège par un second code, donné par une application
          d’authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator, 1Password…).
          Confirmez d’abord votre mot de passe.
        </p>
        <form onSubmit={begin} className="sa-gate-form">
          <div className="card form">
            <label>
              Mot de passe
              <input
                id="superadmin-enroll-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !password}>
            Continuer
          </button>
        </form>
      </GateFrame>
    );
  }

  return (
    <GateFrame>
      <p className="muted">Scannez ce code avec l’application, puis tapez le code à 6 chiffres qu’elle affiche.</p>
      <form onSubmit={confirm} className="sa-gate-form">
        <div className="card form">
          <div className="form-row sa-qr">
            <img src={secret.qr} alt="QR code à scanner avec l’application d’authentification" width={220} height={220} />
            <span className="muted">Sans appareil photo, saisissez cette clé : <code className="sa-secret">{secret.secret}</code></span>
          </div>
          <CodeField value={code} onChange={setCode} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
          Activer
        </button>
      </form>
    </GateFrame>
  );
}
