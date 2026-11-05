import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { ApiError, apiGet, apiPost } from '../api/client';
import { IntroLogoMark } from '../components/IntroLogoMark';
import { LanguagePicker } from '../components/LanguagePicker';

/**
 * "Forgot your password?" for every dashboard account, community admins
 * and the superadmin alike (Seb, 5 Nov 2026). Same white box as the login
 * page: ask for the email, send a one-hour link by email (Brevo), choose
 * a new password, back to sign in. The superadmin still types the
 * authenticator code after signing in: a reset never skips it.
 */
function ResetShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-panel">
        <IntroLogoMark height={56} delay={0} skip />
        <h1 className="login-wordmark">{title}</h1>
        {children}
        <div>
          <LanguagePicker />
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const { t, language } = useI18n();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/auth/password/forgot', { email: email.trim(), language });
      setSentTo(email.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <ResetShell title={t('reset.sentHeading')}>
        <p className="login-subtitle">{t('reset.sentText', { email: sentTo })}</p>
        <p className="muted reset-note">{t('reset.sentHint')}</p>
        {error && <p className="error-text">{error}</p>}
        <button type="button" className="link-button reset-link" onClick={() => send()} disabled={submitting}>
          {t('reset.sendAgain')}
        </button>
        <Link className="link-button reset-link" to="/login">
          {t('reset.backToSignIn')}
        </Link>
      </ResetShell>
    );
  }

  return (
    <ResetShell title={t('reset.heading')}>
      <form className="reset-form" onSubmit={send}>
        <p className="login-subtitle">{t('reset.intro')}</p>
        <div className="card form">
          <label>
            {t('login.emailLabel')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? t('reset.sending') : t('reset.send')}
        </button>
        <Link className="link-button reset-link" to="/login">
          {t('reset.backToSignIn')}
        </Link>
      </form>
    </ResetShell>
  );
}

interface ResetTokenStatus {
  valid: boolean;
  minLength: number;
}

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<ResetTokenStatus | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus({ valid: false, minLength: 8 });
      return;
    }
    apiGet<ResetTokenStatus>(`/auth/password/reset?token=${encodeURIComponent(token)}`)
      .then(setStatus)
      .catch(() => setStatus({ valid: false, minLength: 8 }));
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!status) return;
    if (password.length < status.minLength) {
      setError(t('reset.tooShort', { count: status.minLength }));
      return;
    }
    if (password !== confirm) {
      setError(t('reset.mismatch'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/auth/password/reset', { token, password });
      navigate('/login?reset=done', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.message === 'reset_link_invalid') {
        setStatus({ valid: false, minLength: status.minLength });
      } else {
        setError(err instanceof ApiError ? err.message : t('login.genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return (
      <ResetShell title={t('reset.newHeading')}>
        <p className="login-subtitle">{t('common.loading')}</p>
      </ResetShell>
    );
  }

  if (!status.valid) {
    return (
      <ResetShell title={t('reset.expiredHeading')}>
        <p className="login-subtitle">{t('reset.expiredText')}</p>
        <Link className="btn btn-primary btn-block" to="/forgot-password">
          {t('reset.askNewLink')}
        </Link>
        <Link className="link-button reset-link" to="/login">
          {t('reset.backToSignIn')}
        </Link>
      </ResetShell>
    );
  }

  return (
    <ResetShell title={t('reset.newHeading')}>
      <form className="reset-form" onSubmit={handleSubmit}>
        <p className="login-subtitle">{t('reset.newIntro', { count: status.minLength })}</p>
        <div className="card form">
          <label>
            {t('reset.newLabel')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              autoFocus
            />
          </label>
          <label>
            {t('reset.confirmLabel')}
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? t('reset.saving') : t('reset.save')}
        </button>
      </form>
    </ResetShell>
  );
}
