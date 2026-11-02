import { useEffect, useState } from 'react';
import { API_BASE_URL, ApiError } from '../api/client';
import {
  announceClosureChange,
  cancelClosure,
  CLOSURE_REASONS,
  getClosure,
  getExportLink,
  requestClosure,
  type ClosureReason,
  type ClosureStatus,
} from '../api/closure';
import type { Poi } from '../api/types';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';

type Step = 'idle' | 'before' | 'confirm';

/**
 * Settings › Account (Seb, 2 Nov 2026): the place's data as one ZIP, and
 * closing the place's account. Two steps, the export first; then the name
 * typed, the password, the authority tick. Thirty days to change one's
 * mind ("Keep my place"); see the backend's place-closure.
 */
export function AccountPanel({ poi }: { poi: Poi }) {
  const { t, language } = useI18n();
  const [status, setStatus] = useState<ClosureStatus | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [reason, setReason] = useState<ClosureReason | ''>('');
  const [confirmName, setConfirmName] = useState('');
  const [password, setPassword] = useState('');
  const [authority, setAuthority] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keptNotice, setKeptNotice] = useState(false);

  useEffect(() => {
    getClosure(poi.id)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [poi.id]);

  const day = (iso: string | Date) =>
    new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' });
  // The date the closing would fall on if asked now.
  const plannedDate = day(new Date(Date.now() + (status?.graceDays ?? 30) * 24 * 60 * 60 * 1000));
  const organisation = poi.legalName ? `${poi.legalName}${poi.legalTaxId ? ` · ${poi.legalTaxId}` : ''}` : poi.name;

  async function download() {
    setDownloading(true);
    setDownloadError(false);
    try {
      const { url } = await getExportLink(poi.id);
      window.location.assign(`${API_BASE_URL}${url}`);
    } catch {
      setDownloadError(true);
    } finally {
      // The browser keeps the page and saves the file; give it a moment.
      setTimeout(() => setDownloading(false), 3000);
    }
  }

  async function close() {
    setBusy(true);
    setError(null);
    try {
      const next = await requestClosure(poi.id, {
        confirmName,
        password: status?.passwordRequired ? password : undefined,
        authority,
        reason: reason || undefined,
      });
      setStatus(next);
      setStep('idle');
      setPassword('');
      announceClosureChange();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '';
      setError(
        message === 'name_mismatch'
          ? t('closure.nameMismatch')
          : message === 'wrong_password'
            ? t('closure.wrongPassword')
            : t('closure.genericError'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function keep() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await cancelClosure(poi.id));
      setKeptNotice(true);
      announceClosureChange();
    } catch {
      setError(t('closure.keepError'));
    } finally {
      setBusy(false);
    }
  }

  const downloadButton = (primary: boolean) => (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn'} disabled={downloading} onClick={download}>
      {downloading ? t('closure.preparing') : t('closure.download')}
    </button>
  );

  if (step === 'before' && status) {
    return (
      <div className="card">
        <p className="closure-steps">
          <strong>{t('closure.stepBefore')}</strong> <span>{t('closure.stepConfirm')}</span>
        </p>
        <p className="card-title">{t('closure.whatHappens')}</p>
        <ul className="closure-list">
          <li>
            <strong>{t('closure.todayLabel')}</strong> {t('closure.todayText')}
          </li>
          <li>
            <strong>{t('closure.untilLabel', { date: plannedDate })}</strong> {t('closure.untilText')}
          </li>
          <li>
            <strong>{t('closure.onLabel', { date: plannedDate })}</strong> {t('closure.onText', { n: status.members })}
          </li>
          <li>
            <strong>{t('closure.keptLabel')}</strong> {t('closure.keptText')}
          </li>
        </ul>
        <p className="card-title">{t('closure.downloadFirst')}</p>
        <p className="muted">{t('closure.dataHint')}</p>
        <div className="card-actions">
          {downloadButton(true)}
          <button type="button" className="btn" onClick={() => setStep('confirm')}>
            {t('closure.continue')}
          </button>
          <button type="button" className="text-action" onClick={() => setStep('idle')}>
            {t('common.cancel')}
          </button>
        </div>
        {downloadError && <p className="error-text">{t('closure.downloadError')}</p>}
      </div>
    );
  }

  if (step === 'confirm' && status) {
    const ready = confirmName.trim().length > 0 && authority && (!status.passwordRequired || password.length > 0);
    return (
      <div className="card">
        <p className="closure-steps">
          <span>{t('closure.stepBefore')}</span> <strong>{t('closure.stepConfirm')}</strong>
        </p>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !busy) void close();
          }}
        >
          <label>
            {t('closure.reasonLabel')}
            <select id="closure-reason" value={reason} onChange={(e) => setReason(e.target.value as ClosureReason | '')}>
              <option value="">{t('closure.chooseReason')}</option>
              {CLOSURE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`closure.reason_${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('closure.nameLabel', { name: status.name })}
            <input
              id="closure-name"
              value={confirmName}
              autoComplete="off"
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={status.name}
            />
          </label>
          {status.passwordRequired && (
            <label>
              {t('closure.passwordLabel')}
              <input
                id="closure-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <label className="closure-check">
            <input
              id="closure-authority"
              type="checkbox"
              checked={authority}
              onChange={(e) => setAuthority(e.target.checked)}
            />
            <span>{t('closure.authority', { org: organisation, date: plannedDate })}</span>
          </label>
          <div className="card-actions">
            <button type="submit" className="btn btn-primary" disabled={!ready || busy}>
              {busy ? t('closure.closing') : t('closure.confirm', { date: plannedDate })}
            </button>
            <button type="button" className="btn" onClick={() => setStep('before')}>
              {t('closure.back')}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="card-title">{t('closure.title')}</p>
      <p className="muted" style={{ marginTop: 4 }}>
        {t('closure.subtitle')}
      </p>
      <div className="account-rows">
        <div className="account-row">
          <span className="account-label">{t('closure.organisationLabel')}</span>
          <span>{organisation}</span>
        </div>
        <div className="account-row">
          <span className="account-label">{t('closure.dataLabel')}</span>
          <span className="muted">{t('closure.dataHint')}</span>
          <div>{downloadButton(false)}</div>
          {downloadError && <p className="error-text">{t('closure.downloadError')}</p>}
        </div>
        <div className="account-row">
          <span className="account-label">{t('closure.closeLabel')}</span>
          {status?.state === 'closing' && status.closesAt ? (
            <>
              <span>{t('closure.closingIntro', { date: day(status.closesAt) })}</span>
              <div>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={keep}>
                  {busy ? t('closure.keeping') : t('closure.keep')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <button
                  type="button"
                  className="text-action text-action-destructive"
                  disabled={!status}
                  onClick={() => {
                    setKeptNotice(false);
                    setStep('before');
                  }}
                >
                  {t('closure.closeEntry')}
                </button>
              </div>
              <span className="muted">{t('closure.closeHint', { days: status?.graceDays ?? 30 })}</span>
            </>
          )}
          {keptNotice && <p className="muted">{t('closure.keptNotice')}</p>}
          {error && step === 'idle' && <p className="error-text">{error}</p>}
        </div>
      </div>
    </div>
  );
}
