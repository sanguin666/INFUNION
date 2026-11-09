import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { Lockup } from '../components/LogoMark';
import { getCampaigns } from '../api/donations';
import type { Campaign } from '../api/types';
import {
  getAllowance,
  getAudience,
  getContactGroups,
  getOutreach,
  sendOutreach,
  sendOutreachTest,
  type Allowance,
  type Audience,
  type OutreachInput,
  type OutreachKind,
  type OutreachView,
} from '../api/contacts';

const KINDS: OutreachKind[] = ['invitation', 'contribution', 'message'];

/**
 * Write to members (Seb, 9 Nov 2026): an email to the people on the
 * community's list, outside the app. An invitation to join (every plan),
 * a request for a contribution with a link to give on the web, or a free
 * message (Essentials and up). What each member receives is shown beside.
 */
export function WriteToMembersPage() {
  const poiId = usePoiId();
  const { t, language } = useI18n();
  const [params] = useSearchParams();
  const initialKind = (KINDS.includes(params.get('kind') as OutreachKind) ? params.get('kind') : 'invitation') as OutreachKind;
  const [kind, setKind] = useState<OutreachKind>(initialKind);
  const [audience, setAudience] = useState<Audience>(initialKind === 'invitation' ? 'notInApp' : 'everyone');
  const [group, setGroup] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [subject, setSubject] = useState(t(`contacts.${initialKind === 'invitation' ? 'invite' : initialKind}SubjectDefault`));
  const [body, setBody] = useState(t(`contacts.${initialKind === 'invitation' ? 'invite' : initialKind}BodyDefault`));
  const [size, setSize] = useState<{ withEmail: number; withoutEmail: number } | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [history, setHistory] = useState<OutreachView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const input: OutreachInput = {
    kind,
    audience,
    ...(audience === 'group' ? { group } : {}),
    subject,
    body,
    campaignId: kind === 'contribution' && campaignId ? campaignId : null,
  };
  const locked = kind !== 'invitation' && allowance !== null && !allowance.canWrite;

  useEffect(() => {
    getContactGroups(poiId).then(setGroups, () => setGroups([]));
    getCampaigns(poiId).then((list) => setCampaigns(list.filter((c) => c.active)), () => setCampaigns([]));
    getAllowance(poiId).then(setAllowance, () => setAllowance(null));
    getOutreach(poiId).then(setHistory, () => setHistory([]));
  }, [poiId]);

  // The history fills in while the emails leave.
  useEffect(() => {
    if (!history?.some((o) => !o.finishedAt)) return;
    const timer = window.setTimeout(() => getOutreach(poiId).then(setHistory, () => undefined), 3000);
    return () => window.clearTimeout(timer);
  }, [history, poiId]);

  useEffect(() => {
    if (audience === 'group' && !group) {
      setSize(null);
      return;
    }
    let live = true;
    getAudience(poiId, input).then((s) => live && setSize(s), () => live && setSize(null));
    return () => {
      live = false;
    };
  }, [poiId, kind, audience, group]);

  function chooseKind(next: OutreachKind) {
    const key = next === 'invitation' ? 'invite' : next;
    const prevKey = kind === 'invitation' ? 'invite' : kind;
    // A text the team hasn't touched follows the kind; their own stays.
    if (subject === t(`contacts.${prevKey}SubjectDefault`)) setSubject(t(`contacts.${key}SubjectDefault`));
    if (body === t(`contacts.${prevKey}BodyDefault`)) setBody(t(`contacts.${key}BodyDefault`));
    if (next === 'invitation' && audience === 'everyone') setAudience('notInApp');
    setKind(next);
    setError(null);
    setNotice(null);
  }

  async function send() {
    if (!size || size.withEmail === 0) return;
    if (!window.confirm(t('contacts.sendConfirm', { count: size.withEmail }))) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const sent = await sendOutreach(poiId, input);
      setHistory((h) => [sent, ...(h ?? [])]);
      setNotice(t('contacts.sentNotice', { count: sent.recipients }));
      getAllowance(poiId).then(setAllowance, () => undefined);
      getAudience(poiId, input).then(setSize, () => undefined);
    } catch (err) {
      setError(errorText((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { to } = await sendOutreachTest(poiId, input);
      setNotice(t('contacts.testSent', { email: to }));
    } catch (err) {
      setError(errorText((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  function errorText(code: string): string {
    if (code === 'allowance_exceeded') return t('contacts.allowanceExceeded');
    if (code === 'not_in_plan') return t('contacts.notInPlan');
    if (code === 'nobody_to_write_to') return t('contacts.nobody');
    if (code === 'no_email') return t('contacts.noEmailForTest');
    return t('contacts.sendError');
  }

  const sample = t('contacts.previewName');
  const personal = (text: string) => text.replace(/\s*\{name\}/g, (all) => all.replace('{name}', sample));
  const button = kind === 'invitation' ? t('contacts.previewJoin') : kind === 'contribution' ? t('contacts.previewContribute') : null;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const campaign = campaigns.find((c) => c.id === campaignId);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to=".." relative="path" className="btn">
          {t('members.back')}
        </Link>
      </div>
      <h2>{t('contacts.writeTitle')}</h2>
      <p className="muted">{t('contacts.writeSubtitle')}</p>

      <div className="write-layout">
        <div>
          <div className="card form">
            <p className="card-title" style={{ marginTop: 0 }}>
              {t('contacts.whatToSend')}
            </p>
            <div className="chips">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip${kind === k ? ' chip-selected' : ''}`}
                  aria-pressed={kind === k}
                  onClick={() => chooseKind(k)}
                >
                  {t(`contacts.kind_${k}`)}
                </button>
              ))}
            </div>
            {locked && (
              <p className="muted" style={{ fontSize: 15 }}>
                {t('contacts.notInPlan')}{' '}
                <Link to="../../modules" relative="path">
                  {t('contacts.seePlans')}
                </Link>
              </p>
            )}

            <label className="form-after-rows">
              {t('contacts.to')}
              <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                <option value="notInApp">{t('contacts.aud_notInApp')}</option>
                <option value="notInvited">{t('contacts.aud_notInvited')}</option>
                {kind !== 'invitation' && <option value="everyone">{t('contacts.aud_everyone')}</option>}
                {groups.length > 0 && <option value="group">{t('contacts.aud_group')}</option>}
              </select>
            </label>
            {audience === 'group' && (
              <label>
                {t('contacts.groupLabel')}
                <select value={group} onChange={(e) => setGroup(e.target.value)}>
                  <option value="">—</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="field-hint muted" style={{ fontSize: 15, margin: '4px 0 8px' }}>
              {size === null
                ? ' '
                : size.withEmail === 0 && size.withoutEmail === 0
                  ? t('contacts.nobody')
                  : t('contacts.audienceSize', { count: size.withEmail }) +
                    (size.withoutEmail > 0 ? ` ${t('contacts.audienceNoEmail', { count: size.withoutEmail })}` : '')}
            </p>

            {kind === 'contribution' && (
              <label>
                {t('contacts.project')}
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">{t('contacts.projectNone')}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {t('contacts.subject')}
              <input value={subject} maxLength={160} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label>
              {t('contacts.message')}
              <textarea value={body} rows={8} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
            </label>
            <p className="field-hint muted" style={{ fontSize: 15, margin: '4px 0 0' }}>
              {t('contacts.nameHint')}
            </p>

            {error && <p className="error-text">{error}</p>}
            {notice && <p className="muted">{notice}</p>}
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || locked || !size || size.withEmail === 0 || !subject.trim() || !body.trim()}
                onClick={() => void send()}
              >
                {t('contacts.sendTo', { count: size?.withEmail ?? 0 })}
              </button>
              <button type="button" className="btn" disabled={busy || locked || !subject.trim() || !body.trim()} onClick={() => void test()}>
                {t('contacts.sendTest')}
              </button>
            </div>
            {allowance && (
              <p className="muted" style={{ fontSize: 15 }}>
                {t('contacts.allowance', { used: allowance.used.toLocaleString(intlLocale(language)), limit: allowance.limit.toLocaleString(intlLocale(language)) })}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            {t('contacts.previewTitle', { name: sample })}
          </p>
          <div className="card email-preview" aria-label={t('contacts.previewTitle', { name: sample })}>
            <div className="email-preview-head">
              <Lockup height={24} />
            </div>
            <div className="email-preview-line" />
            <div className="email-preview-body">
              <h3>{personal(subject)}</h3>
              <p>{personal(body)}</p>
              {campaign && <p className="muted">{t('contacts.previewProject', { project: campaign.title })}</p>}
              {button && <span className="email-preview-button">{button}</span>}
              <p className="email-preview-foot">{t('contacts.previewWhy')}</p>
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 32 }}>{t('contacts.historyTitle')}</h3>
      {history?.length === 0 && <p className="muted">{t('contacts.historyEmpty')}</p>}
      {history && history.length > 0 && (
        <div className="card card-list">
          {history.map((o) => (
            <div key={o.id} className="card-row" style={{ display: 'block' }}>
              <p className="card-title" style={{ margin: 0, fontSize: 17 }}>
                {o.subject}
              </p>
              <p className="card-meta">
                {t(`contacts.kind_${o.kind}`)} · {date(o.createdAt)}
              </p>
              <div className="outreach-figures">
                <span>
                  {o.finishedAt ? t('contacts.figSent', { count: o.sent }) : t('contacts.figSending', { sent: o.sent, total: o.recipients })}
                </span>
                {o.failed > 0 && <span>{t('contacts.figFailed', { count: o.failed })}</span>}
                {o.kind !== 'message' && <span>{t('contacts.figClicked', { count: o.clicked })}</span>}
                <span>{t('contacts.figJoined', { count: o.joined })}</span>
                {o.kind === 'contribution' && (
                  <span>
                    {t('contacts.figContributed', {
                      count: o.contributed,
                      amount: o.contributedAmount.toLocaleString(intlLocale(language), { style: 'currency', currency: 'EUR' }),
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
