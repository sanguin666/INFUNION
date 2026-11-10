import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { askAdminAssistant, getAdminAssistant, type AssistantTurn } from '../api/adminAssistant';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n/I18nContext';

// The dashboard page behind each link the assistant can give, and its menu name.
const PAGE_LABEL: Record<string, string> = {
  dashboard: 'layout.navDashboard',
  'home-page': 'layout.navHomePage',
  members: 'layout.navMembers',
  requests: 'layout.navRequests',
  events: 'layout.navEvents',
  announcements: 'layout.navAnnouncements',
  donations: 'layout.navDonations',
  'mass-intentions': 'layout.navMassIntentions',
  'prayer-requests': 'layout.navPrayerRequests',
  readings: 'layout.navReadings',
  livestreams: 'layout.navLivestreams',
  community: 'layout.navCommunity',
  settings: 'layout.navSettings',
  modules: 'layout.navModules',
  website: 'layout.navWebsite',
  'my-qr': 'layout.navMyQr',
};

type Turn = AssistantTurn & { actions?: string[] };

function Sparkle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5Z"
        fill="currentColor"
      />
      <path d="M19 15.5c.2 1.8 1.1 2.7 2.9 2.9-1.8.2-2.7 1.1-2.9 2.9-.2-1.8-1.1-2.7-2.9-2.9 1.8-.2 2.7-1.1 2.9-2.9Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The dashboard's AI assistant (Seb, 6 Nov 2026): a yellow "Ask" button at
 * the bottom right of every page opens a side panel where the team asks
 * how to do something, about modules or plans. Answers come from the
 * admin guide, with buttons to the right pages.
 */
export function AdminAssistant({ poiId }: { poiId: string }) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'limit' | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTurns([]);
    setError(null);
    getAdminAssistant(poiId)
      .then((s) => {
        setAvailable(s.available);
        setRemaining(s.remaining);
      })
      .catch(() => setAvailable(false));
  }, [poiId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, busy, error]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!available) return null;

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Turn[] = [...turns, { role: 'member', text: question }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const reply = await askAdminAssistant(
        poiId,
        next.slice(-10).map(({ role, text: body }) => ({ role, text: body })),
        language,
      );
      setTurns([...next, { role: 'assistant', text: reply.answer, actions: reply.actions }]);
      setRemaining(reply.remaining);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'limit' : 'error');
      if (err instanceof ApiError && err.status === 429) setRemaining(0);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  const outOfQuestions = remaining === 0;

  return (
    <>
      {!open && (
        <button type="button" className="ask-fab" onClick={() => setOpen(true)} aria-label={t('assistant.open')}>
          <Sparkle />
          <span>{t('assistant.short')}</span>
        </button>
      )}
      {open && (
        <aside className="ask-panel" role="dialog" aria-label={t('assistant.title')}>
          <header className="ask-head">
            <span className="ask-badge" aria-hidden="true">
              <Sparkle size={20} />
            </span>
            <span className="ask-head-text">
              <strong>{t('assistant.title')}</strong>
              <span className="muted">{t('assistant.subtitle')}</span>
            </span>
            {turns.length > 0 && (
              <button type="button" className="text-action" onClick={() => { setTurns([]); setError(null); }}>
                {t('assistant.restart')}
              </button>
            )}
            <button type="button" className="ask-close" onClick={() => setOpen(false)} aria-label={t('assistant.close')}>
              ×
            </button>
          </header>

          <div className="ask-body" aria-live="polite">
            <p className="ask-bubble ask-bubble-ai">{t('assistant.intro')}</p>
            {turns.length === 0 && (
              <div className="ask-suggestions">
                {(['s1', 's2', 's3'] as const).map((key) => (
                  <button key={key} type="button" className="chip" disabled={outOfQuestions} onClick={() => void ask(t(`assistant.${key}`))}>
                    {t(`assistant.${key}`)}
                  </button>
                ))}
              </div>
            )}
            {turns.map((turn, i) =>
              turn.role === 'member' ? (
                <p key={i} className="ask-bubble ask-bubble-me">
                  {turn.text}
                </p>
              ) : (
                <div key={i} className="ask-answer">
                  <p className="ask-bubble ask-bubble-ai">{turn.text}</p>
                  {turn.actions && turn.actions.length > 0 && (
                    <div className="ask-actions">
                      {turn.actions
                        .filter((page) => PAGE_LABEL[page])
                        .map((page) => (
                          <button
                            key={page}
                            type="button"
                            className="btn"
                            onClick={() => navigate(`/poi/${poiId}/${page}`)}
                          >
                            {t('assistant.goTo', { page: t(PAGE_LABEL[page] as Parameters<typeof t>[0]) })} ›
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && <p className="ask-bubble ask-bubble-ai ask-thinking">{t('assistant.thinking')}</p>}
            {error && <p className="error-text">{t(error === 'limit' ? 'assistant.limit' : 'assistant.error')}</p>}
            <div ref={endRef} />
          </div>

          <form className="ask-form" onSubmit={submit}>
            <label className="visually-hidden" htmlFor="ask-input">
              {t('assistant.inputLabel')}
            </label>
            <div className="ask-row">
              <textarea
                id="ask-input"
                ref={inputRef}
                rows={2}
                maxLength={800}
                value={draft}
                placeholder={t('assistant.inputLabel')}
                disabled={outOfQuestions}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void ask(draft);
                  }
                }}
              />
              <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim() || outOfQuestions}>
                {t('assistant.send')}
              </button>
            </div>
            <p className="ask-note">
              {t('assistant.note')}
              {remaining !== null && remaining <= 10 && ` ${t('assistant.left', { n: remaining })}`}
            </p>
          </form>
        </aside>
      )}
    </>
  );
}
