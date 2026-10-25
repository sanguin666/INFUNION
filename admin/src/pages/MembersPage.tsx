import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModules, usePoiId, useRefreshModules } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { getBilling, startModule } from '../api/billing';
import {
  MODULE_OFF,
  getMemberConversation,
  getMembers,
  sendMemberMessage,
  type MemberConversation,
  type MemberRow,
} from '../api/members';

type T = ReturnType<typeof useI18n>['t'];

const LIVE = new Set(['trial', 'active']);

function nameOf(member: Pick<MemberRow, 'firstName' | 'lastName' | 'phone'>, t: T): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.phone || t('members.unnamed');
}

function initials(member: Pick<MemberRow, 'firstName' | 'lastName'>): string {
  return [member.firstName, member.lastName].map((part) => part?.trim()[0] ?? '').join('').toUpperCase() || '·';
}

// Accents and case aside, so "maria" finds María; digits only for phones.
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function matches(member: MemberRow, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const name = fold([member.firstName, member.lastName].filter(Boolean).join(' '));
  const digits = (member.phone ?? '').replace(/\D/g, '');
  return words.every((word) => name.includes(word) || (/\d/.test(word) && digits.includes(word.replace(/\D/g, ''))));
}

/**
 * Membres (Seb, 25 Oct 2026): everyone who joined the place, and with the
 * Messages module a conversation with each of them. Without the module
 * the list stays, and the page offers the module instead of writing.
 */
export function MembersPage() {
  const poiId = usePoiId();
  const modules = useModules();
  const refreshModules = useRefreshModules();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const [loaded, setLoaded] = useState<{ poiId: string; members: MemberRow[] } | null>(null);
  const members = loaded && loaded.poiId === poiId ? loaded.members : null;
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Whether this place already had its free month, so the offer either
  // starts the trial here or sends the office to Modules.
  const [trialUsed, setTrialUsed] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const offerRef = useRef<HTMLDivElement>(null);

  const live = !!modules?.some((m) => m.moduleType === 'messages' && LIVE.has(m.status));

  useEffect(() => {
    getMembers(poiId)
      .then((list) => setLoaded({ poiId, members: list }))
      .catch(() => setError(t('members.loadError')));
  }, [poiId]);

  useEffect(() => {
    if (modules === null || live) return;
    getBilling(poiId)
      .then((billing) => setTrialUsed(billing.modules.some((m) => m.moduleType === 'messages')))
      .catch(() => setTrialUsed(true));
  }, [poiId, modules === null, live]);

  async function startTrial() {
    if (trialUsed) {
      navigate('../modules', { relative: 'path' });
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await startModule(poiId, 'messages');
      refreshModules();
    } catch {
      setError(t('members.promoError'));
    } finally {
      setStarting(false);
    }
  }

  function write(member: MemberRow) {
    if (live) {
      navigate(member.userId);
      return;
    }
    offerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    offerRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long' });
  const when = (iso: string) => {
    const at = new Date(iso);
    const sameDay = at.toDateString() === new Date().toDateString();
    return sameDay
      ? at.toLocaleTimeString(intlLocale(language), { hour: '2-digit', minute: '2-digit' })
      : at.toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'short' });
  };
  const shown = members?.filter((m) => !query.trim() || matches(m, query)) ?? null;

  return (
    <div>
      <h2>{t('members.title')}</h2>
      <p className="muted">
        {live ? t('members.subtitleLive') : members ? t('members.subtitleOff', { count: members.length }) : ''}
      </p>

      {modules !== null && !live && (
        <div className="card" ref={offerRef}>
          <p className="card-title">{t('members.promoTitle')}</p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('members.promoText')}
          </p>
          <div className="card-actions">
            <button type="button" className="btn btn-primary" onClick={startTrial} disabled={starting || trialUsed === null}>
              {trialUsed ? t('members.promoActivate') : t('members.promoTry')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {members === null && !error && <p className="muted">{t('members.loading')}</p>}
      {members?.length === 0 && <p className="muted">{t('members.empty')}</p>}

      {members && members.length > 0 && (
        <>
          <div className="card form">
            <label>
              {t('members.search')}
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {shown?.length === 0 && <p className="muted">{t('members.noMatch')}</p>}
          {shown && shown.length > 0 && (
            <div className="card card-list" role="list">
              {shown.map((member) => (
                <div key={member.userId} className="card-row" role="listitem">
                  <span className="member-initials" aria-hidden="true">
                    {initials(member)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="card-title" style={{ margin: 0, fontSize: 17 }}>
                      {nameOf(member, t)}
                      {live && member.unread && <span className="badge badge-active"> · {t('members.newBadge')}</span>}
                    </p>
                    <p className="card-meta member-preview">
                      {live && member.lastMessage
                        ? `${member.lastMessage.fromStaff ? t('members.you', { body: member.lastMessage.body }) : member.lastMessage.body} · ${when(member.lastMessage.createdAt)}`
                        : [member.phone, t('members.memberSince', { date: date(member.joinedAt) })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" className="btn" onClick={() => write(member)}>
                    {live && member.lastMessage ? t('members.open') : t('members.write')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One member's conversation with the office. */
export function MemberConversationPage() {
  const poiId = usePoiId();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const [conversation, setConversation] = useState<MemberConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setConversation(null);
    getMemberConversation(poiId, userId!)
      .then(setConversation)
      .catch((err: Error) => {
        // Module switched off meanwhile: back to the list, which offers it.
        if (err.message === MODULE_OFF) navigate('..', { relative: 'path', replace: true });
        else setError(t('members.loadError'));
      });
  }, [poiId, userId]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      setConversation(await sendMemberMessage(poiId, userId!, message.trim()));
      setMessage('');
    } catch {
      setError(t('members.sendError'));
    } finally {
      setSending(false);
    }
  }

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(intlLocale(language), { dateStyle: 'medium', timeStyle: 'short' });
  const back = (
    <div style={{ marginBottom: 16 }}>
      <Link to=".." relative="path" className="btn">
        {t('members.back')}
      </Link>
    </div>
  );

  if (!conversation) {
    return (
      <div>
        {back}
        {error ? <p className="error-text">{error}</p> : <p className="muted">{t('members.loading')}</p>}
      </div>
    );
  }

  const { member, messages } = conversation;
  const name = nameOf(member, t);

  return (
    <div>
      {back}
      <h2>{name}</h2>
      <p className="muted">
        {[member.phone, t('members.memberSince', { date: new Date(member.joinedAt).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long' }) })]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {messages.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t('members.noMessages')}
          </p>
        ) : (
          <ul className="card-rows" style={{ marginTop: 0 }}>
            {messages.map((m) => (
              <li key={m.id} className="card-row" style={{ display: 'block' }}>
                <p style={{ margin: 0, fontWeight: 700 }} className={m.fromStaff ? 'badge-active' : undefined}>
                  {m.fromStaff ? t('requests.fromOffice', { name: m.authorName ?? t('requests.office') }) : name}
                </p>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
                <p className="card-meta">{formatDateTime(m.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}

        <form className="form form-after-rows" onSubmit={handleSend}>
          <label>
            {t('members.messageLabel')}
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} />
          </label>
          <div className="card-actions">
            <button type="submit" className="btn btn-primary" disabled={sending || !message.trim()}>
              {sending ? t('members.sending') : t('members.send')}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 15 }}>
            {t('members.sendHint', { name: member.firstName || name })}
          </p>
        </form>
      </div>
    </div>
  );
}
