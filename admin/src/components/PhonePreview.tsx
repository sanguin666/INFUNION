import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import type { PoiBadge, PoiPageBlock } from '../api/types';

// The app's web version, which the phone frame loads in preview mode.
// `npm run start` in app/ serves it here; see admin/.env.example.
const APP_PREVIEW_URL = (import.meta.env.VITE_APP_PREVIEW_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const APP_ORIGIN = new URL(APP_PREVIEW_URL).origin;

// How long the app gets to say it has loaded before the frame explains
// what to start.
const READY_TIMEOUT_MS = 12_000;

type Props = {
  poiId: string;
  // What the editor holds right now, saved or not. Null until loaded,
  // and the app then shows what the server has.
  badges: PoiBadge[] | null;
  blocks: PoiPageBlock[] | null;
  // Ids of the badges and sections with changes not saved yet.
  drafts: string[];
};

/**
 * The place's home page in a phone, as a member sees it, beside the
 * editor. It is the real app, framed, so what shows here is what the
 * app draws; the editor's content is pushed into it as it changes, so a
 * message shows while it is still being typed.
 */
export function PhonePreview({ poiId, badges, blocks, drafts }: Props) {
  const { t, language } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const [previewLanguage, setPreviewLanguage] = useState<SupportedLanguage>(language);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // The frame's address is fixed for a place, so switching language or
  // typing never reloads it; both go over postMessage instead.
  const [src] = useState(
    () => `${APP_PREVIEW_URL}/?preview=${encodeURIComponent(poiId)}&lang=${previewLanguage}`,
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== APP_ORIGIN || event.source !== frame.current?.contentWindow) return;
      if (event.data?.source === 'infunion-app' && event.data?.type === 'ready') {
        setReady(true);
        setTimedOut(false);
      }
    }
    window.addEventListener('message', onMessage);
    const timer = window.setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage(
      {
        source: 'infunion-admin',
        type: 'preview',
        language: previewLanguage,
        // Switched-off badges never reach a member's phone either.
        badges: badges?.filter((badge) => badge.enabled) ?? undefined,
        blocks: blocks ?? undefined,
        drafts,
      },
      APP_ORIGIN,
    );
    // The page rebuilds `drafts` on every render; its contents are what count.
  }, [ready, previewLanguage, badges, blocks, drafts.join()]);

  return (
    <aside className="phone-preview" aria-labelledby="phone-preview-title">
      <p id="phone-preview-title" className="phone-preview-title">
        <span className="phone-preview-live" aria-hidden="true" />
        {t('preview.title')}
      </p>
      <div className="phone-frame">
        <iframe ref={frame} src={src} title={t('preview.frameTitle')} />
        {timedOut && !ready && <p className="phone-preview-missing">{t('preview.notRunning')}</p>}
      </div>
      <div className="chips" role="radiogroup" aria-label={t('preview.languageLabel')}>
        {SUPPORTED_LANGUAGES.map((code) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={previewLanguage === code}
            className={`chip ${previewLanguage === code ? 'chip-selected' : ''}`}
            onClick={() => setPreviewLanguage(code)}
          >
            {LANGUAGE_NAMES[code]}
          </button>
        ))}
      </div>
      <p className="muted phone-preview-hint">{t('preview.hint')}</p>
    </aside>
  );
}
