import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { ApiError } from '../api/client';
import { IntroLogoMark } from '../components/IntroLogoMark';
import { LanguagePicker } from '../components/LanguagePicker';
import { SuperadminCodeDialog } from '../superadmin/SuperadminGate';
import type { CurrentUser } from '../api/types';

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The superadmin's second step pops up over this form (Seb, 18 Oct 2026).
  const [superadmin, setSuperadmin] = useState<CurrentUser | null>(null);
  // The page arrives in steps, like the app opening: the picture, then
  // the white box, then the hearts meeting, then the form. Any click or
  // key jumps to the end, and it never plays for somebody who has asked
  // for less motion.
  const [skipIntro, setSkipIntro] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    if (skipIntro) return;
    const skip = () => setSkipIntro(true);
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [skipIntro]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const me = await login(email.trim(), password);
      if (me.isSuperadmin) setSuperadmin(me);
      else navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  // The app's welcome screen: the logo and the words in a patch of white
  // light over the illustration, then one white form, the orange button
  // and the language row — nothing else to read and nothing to get wrong.
  return (
    <div className={skipIntro ? 'login-page' : 'login-page login-intro'}>
      <form className="login-panel" onSubmit={handleSubmit}>
        <IntroLogoMark size={180} delay={900} skip={skipIntro} />
        <h1 className="login-wordmark">{t('login.heading')}</h1>
        <p className="login-subtitle login-step">{t('login.subtitle')}</p>

        <div className="card form login-step">
          <label>
            {t('login.emailLabel')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {t('login.passwordLabel')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block login-step" disabled={submitting}>
          {submitting ? t('login.signingIn') : t('login.signIn')}
        </button>

        <div className="login-step">
          <LanguagePicker />
        </div>
      </form>
      {superadmin && (
        <SuperadminCodeDialog
          onDone={() => navigate('/superadmin', { replace: true })}
          onCancel={superadmin.adminPois.length ? () => navigate('/', { replace: true }) : undefined}
        />
      )}
    </div>
  );
}
