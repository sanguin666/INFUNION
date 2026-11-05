import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';

/**
 * Settings' "Show the tour and tips again" (Seb, 5 Nov 2026): for his
 * tests, and for anyone in the team who wants the welcome again. The tour
 * starts on the dashboard straight away.
 */
export function TourResetCard() {
  const { t } = useI18n();
  const { resetTips } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function reset() {
    setBusy(true);
    setFailed(false);
    try {
      await resetTips();
      navigate('../dashboard');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="card-title">{t('tour.resetTitle')}</p>
      <p className="muted">{t('tour.resetText')}</p>
      <div className="card-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={reset}>
          {t('tour.resetButton')}
        </button>
      </div>
      {failed && <p className="error-text">{t('tour.resetFailed')}</p>}
    </div>
  );
}
