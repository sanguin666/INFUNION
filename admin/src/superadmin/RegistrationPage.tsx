import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../api/client';
import {
  approveRegistration,
  declineRegistration,
  getRegistration,
  questionRegistration,
  setRegistrationDocumentChecked,
  type RegistrationCheck,
  type RegistrationDetail,
} from '../api/superadmin';
import type { PoiType } from '../api/types';
import { LANGUAGE_NAMES } from '../i18n/translations';
import { useI18n } from '../i18n/I18nContext';
import { PLACE_KINDS } from '../placeKinds';
import { useSa } from './format';
import { PasswordReveal } from './PasswordReveal';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="card-row sa-kv-row">
      <span className="sa-kv-label">{label}</span>
      <span className="sa-kv-value">{children}</span>
    </div>
  );
}

/**
 * One place's request (Seb, 30 Oct 2026): what they sent, the checks, the
 * document, and the decision. Approve stays off until the document is
 * ticked as checked, Basic included: Basic is free, so it is the plan a
 * mass sign-up would aim at.
 */
export function SuperadminRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RegistrationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<PoiType>('church');
  const [offerPlan, setOfferPlan] = useState(false);
  const [mode, setMode] = useState<'question' | 'decline' | 'block' | null>(null);
  const [text, setText] = useState('');
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);
  const { s, date, dateTime, planLabel, error: describe } = useSa();
  const { t } = useI18n();

  function show(detail: RegistrationDetail) {
    setData(detail);
    setKind(detail.type);
  }

  useEffect(() => {
    if (!id) return;
    getRegistration(id)
      .then(show)
      .catch((err) => setError(describe(err)));
  }, [id]);

  async function run(action: () => Promise<RegistrationDetail>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      show(await action());
      setMode(null);
      setText('');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const result = await approveRegistration(data.id, { type: kind, offerPlan: offerPlan || undefined });
      show(result.registration);
      const place = result.registration.placeName;
      if (result.admin.temporaryPassword) {
        setNotice(result.emailsDelivered ? s('registrations.approvedNotice', { place, email: data.email }) : s('registrations.approvedNoEmail', { place }));
        if (!result.emailsDelivered) setReveal({ email: result.admin.email, password: result.admin.temporaryPassword });
      } else {
        setNotice(s('registrations.existingAdmin', { email: data.email, place }));
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="error-text">{error}</p>;
  if (!data) return <p className="muted">{s('common.loading')}</p>;

  const open = data.status === 'pending' || data.status === 'question';
  const paid = data.plan !== 'basic';

  function checkText(check: RegistrationCheck): string {
    const params = { detail: check.detail ?? '', n: check.n ?? 0 };
    if (check.key === 'emailConfirmed') return s('registrations.check_emailConfirmed');
    if (check.key === 'account') return s(`registrations.check_account_${check.detail}`);
    return s(`registrations.check_${check.key}_${check.level === 'ok' ? 'ok' : 'warn'}`, params);
  }

  const documentLink = data.documentUrl ? `${API_BASE_URL}${data.documentUrl}` : null;

  return (
    <div>
      <p>
        <Link to="..">← {s('registrations.back')}</Link>
      </p>
      <div className="sa-heading">
        <h2>{data.placeName}</h2>
      </div>
      <p className="muted">
        {data.claim && data.existingPoi
          ? `${s('registrations.claim')}: ${data.existingPoi.name}`
          : `${t(`location.kind_${data.type}`)} · ${data.city}`}{' '}
        · {planLabel(data.plan)} ({s(`registrations.interval_${data.billingInterval}`)}) · {dateTime(data.createdAt)}
      </p>

      {error && <p className="error-text" role="alert">{error}</p>}
      {notice && <p className="sa-notice" role="status">{notice}</p>}
      {reveal && <PasswordReveal email={reveal.email} password={reveal.password} onClose={() => setReveal(null)} />}

      <h3>{s('registrations.checks')}</h3>
      <div className="card card-list">
        {data.checks.map((check) => (
          <div className="card-row sa-check-row" key={check.key}>
            <span className={`sa-dot sa-dot-${check.level === 'warn' ? 'warn' : 'ok'}`} aria-hidden="true" />
            <span>{checkText(check)}</span>
          </div>
        ))}
      </div>

      <h3>{s('registrations.document')}</h3>
      <div className="card card-list">
        <div className="card-row">
          <span>
            <span className="card-title">{data.documentName ?? s('registrations.noDocument')}</span>
            {data.documentCheckedAt && <span className="sa-sub">{s('registrations.documentChecked')} · {dateTime(data.documentCheckedAt)}</span>}
          </span>
          <span className="sa-row-actions">
            {documentLink && (
              <a className="btn" href={documentLink} target="_blank" rel="noreferrer">
                {s('registrations.openDocument')}
              </a>
            )}
            {open && documentLink && (
              <label className="sa-inline-check">
                <input
                  id="sa-reg-document-checked"
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={!!data.documentCheckedAt}
                  disabled={busy}
                  onChange={(e) => run(() => setRegistrationDocumentChecked(data.id, e.target.checked))}
                />
                {s('registrations.documentChecked')}
              </label>
            )}
          </span>
        </div>
      </div>

      <h3>{s('registrations.place')}</h3>
      <div className="card card-list">
        <Row label={s('registrations.name')}>{data.placeName}</Row>
        <Row label={s('registrations.kind')}>{t(`location.kind_${data.type}`)}</Row>
        <Row label={s('registrations.address')}>
          {data.address}, {data.postalCode} {data.city} ({data.country})
        </Row>
        <Row label={s('registrations.language')}>{LANGUAGE_NAMES[data.language] ?? data.language}</Row>
        <Row label={s('registrations.website')}>
          {data.website ? (
            <a href={/^https?:\/\//.test(data.website) ? data.website : `https://${data.website}`} target="_blank" rel="noreferrer">
              {data.website}
            </a>
          ) : (
            s('registrations.noWebsite')
          )}
        </Row>
        <Row label={s('registrations.legalName')}>{data.legalName}</Row>
        <Row label={s('registrations.taxId')}>
          <span className="sa-mono">{data.taxId}</span>
        </Row>
      </div>

      <h3>{s('registrations.applicant')}</h3>
      <div className="card card-list">
        <Row label={s('registrations.name')}>
          {data.firstName} {data.lastName}
        </Row>
        <Row label={s('registrations.role')}>{data.role}</Row>
        <Row label={s('registrations.email')}>{data.email}</Row>
        <Row label={s('registrations.phone')}>{data.phone ?? '—'}</Row>
      </div>

      <h3>{s('registrations.agreement')}</h3>
      <div className="card card-list">
        <Row label={s('registrations.agreement')}>
          {s('registrations.signed', { name: data.signedName, date: dateTime(data.signedAt) })}
          <span className="sa-sub">
            {s('registrations.versions', { terms: data.termsVersion, dpa: data.dpaVersion })}
            {data.religiousDataAgreed ? ` · ${s('registrations.religious')}` : ''}
            {data.ip ? ` · ${s('registrations.fromIp', { ip: data.ip })}` : ''}
          </span>
        </Row>
      </div>

      <h3>{s('registrations.decide')}</h3>
      {data.question && (
        <p className="muted">
          {s('registrations.lastQuestion', { date: date(data.questionedAt) })} “{data.question}”
        </p>
      )}
      {data.status === 'approved' && (
        <p>
          {s('registrations.approvedOn', { date: date(data.decidedAt), who: data.decidedBy ?? '—' })}{' '}
          {data.poiId && <Link to={`../../communities/${data.poiId}`}>{s('registrations.openPlace')}</Link>}
        </p>
      )}
      {data.status === 'declined' && (
        <p>
          {s('registrations.declinedOn', { date: date(data.decidedAt), who: data.decidedBy ?? '—' })} “{data.declineReason}”
        </p>
      )}

      {open && (
        <>
          {!data.claim && (
            <div className="card form">
              <label>
                {s('registrations.kind')}
                <select id="sa-reg-kind" value={kind} onChange={(e) => setKind(e.target.value as PoiType)}>
                  {PLACE_KINDS.map((option) => (
                    <option key={option} value={option}>
                      {t(`location.kind_${option}`)}
                    </option>
                  ))}
                </select>
                <span className="muted sa-hint">{s('registrations.kindHint', { kind: t(`location.kind_${data.type}`) })}</span>
              </label>
              {paid && (
                <label className="sa-inline-check">
                  <input id="sa-reg-offer" type="checkbox" checked={offerPlan} onChange={(e) => setOfferPlan(e.target.checked)} />
                  {s('registrations.offerPlan', { plan: planLabel(data.plan) })}
                </label>
              )}
            </div>
          )}

          {mode && (
            <div className="card form sa-gap">
              <label>
                {mode === 'question' ? s('registrations.questionLabel', { email: data.email }) : s('registrations.reasonLabel', { email: data.email })}
                <textarea id="sa-reg-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
                {mode === 'block' && <span className="muted sa-hint">{s('registrations.blockHint')}</span>}
              </label>
            </div>
          )}

          <div className="card-actions sa-actions">
            {mode === null && (
              <>
                <button type="button" className="btn btn-primary" disabled={busy || !data.documentCheckedAt} onClick={approve}>
                  {data.claim ? s('registrations.approveClaim') : s('registrations.approve')}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setMode('question')}>
                  {s('registrations.askQuestion')}
                </button>
                <button type="button" className="btn btn-destructive" disabled={busy} onClick={() => setMode('decline')}>
                  {s('registrations.decline')}
                </button>
                <button type="button" className="btn btn-destructive" disabled={busy} onClick={() => setMode('block')}>
                  {s('registrations.declineBlock')}
                </button>
              </>
            )}
            {mode !== null && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !text.trim()}
                  onClick={() =>
                    run(() =>
                      mode === 'question'
                        ? questionRegistration(data.id, text.trim())
                        : declineRegistration(data.id, text.trim(), mode === 'block'),
                    )
                  }
                >
                  {mode === 'question' ? s('registrations.send') : mode === 'block' ? s('registrations.confirmBlock') : s('registrations.confirmDecline')}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setMode(null)}>
                  {s('common.cancel')}
                </button>
              </>
            )}
          </div>
          {!data.documentCheckedAt && mode === null && <p className="muted sa-hint">{s('registrations.check_documentChecked_warn')}</p>}
        </>
      )}
    </div>
  );
}
