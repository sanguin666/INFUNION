import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
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
import { useSa } from './format';

/**
 * The second lock on the superadmin section: the six-digit code from an
 * authenticator app, asked again every hour. The first time, it sets the
 * app up (password again, then a QR code to scan, then a first code).
 */
export function SuperadminGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(() => !!getSuperadminSession());

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

  if (unlocked) return <>{children}</>;
  return (
    <SuperadminCodeDialog
      onDone={() => setUnlocked(true)}
      onCancel={user?.adminPois.length ? () => navigate('/', { replace: true }) : undefined}
    />
  );
}

/**
 * The code step as a popup (Seb, 18 Oct 2026): it opens straight over the
 * login form once the password is right, and over the section when the
 * hour runs out. "Not now" only shows when there is somewhere else to go.
 */
export function SuperadminCodeDialog({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { s, error: describe } = useSa();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<SuperadminStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    getSuperadminStatus()
      .then(setStatus)
      .catch((err) => setError(describe(err)));
  }, [describe]);

  return (
    <dialog
      ref={dialogRef}
      className="sheet sa-dialog"
      aria-labelledby="sa-dialog-title"
      // Escape only closes it when there is somewhere to go back to.
      onCancel={(e) => {
        e.preventDefault();
        onCancel?.();
      }}
    >
      <div className="sheet-body">
        <h2 id="sa-dialog-title" className="sheet-title">
          {s('nav.title')}
        </h2>
        {error && <p className="error-text">{error}</p>}
        {!error && !status && <p className="muted">{s('common.loading')}</p>}
        {status &&
          (status.enrolled ? <CodeStep onDone={onDone} /> : <EnrollStep email={status.email} onDone={onDone} />)}
        {onCancel && (
          <button type="button" className="btn btn-block" onClick={onCancel}>
            {s('gate.notNow')}
          </button>
        )}
      </div>
    </dialog>
  );
}

function GateFrame({ children }: { children: ReactNode }) {
  return <div className="sa-gate-step">{children}</div>;
}

function CodeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { s } = useSa();
  return (
    <label>
      {s('gate.codeLabel')}
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
  const { s, error: describe } = useSa();
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
      setError(describe(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GateFrame>
      <p className="muted">{s('gate.codeIntro')}</p>
      <form onSubmit={submit} className="sa-gate-form">
        <div className="form sa-dialog-fields">
          <CodeField value={code} onChange={setCode} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
          {busy ? s('gate.checking') : s('gate.enter')}
        </button>
      </form>
    </GateFrame>
  );
}

function EnrollStep({ email, onDone }: { email: string; onDone: () => void }) {
  const { s, error: describe } = useSa();
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState<{ secret: string; qr: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
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
      setSecret({ secret: started.secret, url: started.otpauthUrl, qr: await QRCode.toDataURL(started.otpauthUrl, { margin: 1, width: 220 }) });
    } catch (err) {
      setError(describe(err));
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
      setError(describe(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (!secret) {
    return (
      <GateFrame>
        <p className="muted">{s('gate.enrollIntro', { email })}</p>
        <form onSubmit={begin} className="sa-gate-form">
          <div className="form sa-dialog-fields">
            <label>
              {s('gate.password')}
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
            {s('gate.continue')}
          </button>
        </form>
      </GateFrame>
    );
  }

  return (
    <GateFrame>
      <p className="muted">{s('gate.scanIntro')}</p>
      <form onSubmit={confirm} className="sa-gate-form">
        <div className="form sa-dialog-fields">
          <div className="form-row sa-qr">
            <img src={secret.qr} alt={s('gate.qrAlt')} width={220} height={220} />
            {/* A phone cannot scan its own screen: the otpauth link opens
                the authenticator app directly (Seb, 18 Oct 2026). */}
            <span className="muted">{s('gate.phoneHint')}</span>
            <a className="btn btn-block" href={secret.url}>
              {s('gate.openApp')}
            </a>
            <span className="muted">
              {s('gate.noCamera')} <code className="sa-secret">{secret.secret}</code>{' '}
              <button
                type="button"
                className="text-action"
                onClick={() =>
                  navigator.clipboard
                    .writeText(secret.secret)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }
              >
                {copied ? s('reveal.copied') : s('gate.copyKey')}
              </button>
            </span>
          </div>
          <CodeField value={code} onChange={setCode} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
          {s('gate.activate')}
        </button>
      </form>
    </GateFrame>
  );
}
