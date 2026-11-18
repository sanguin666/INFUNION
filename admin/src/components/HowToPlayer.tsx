import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { formatDuration, type Clip } from './howTo';

/** The player: the clip, and the list of clips beside it. */
export function HowToPlayer({
  clips,
  startAt,
  heading,
  onClose,
}: {
  clips: Clip[];
  startAt?: string | null;
  heading?: string;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const first = Math.max(0, clips.findIndex((clip) => clip.id === startAt));
  const [index, setIndex] = useState(first);
  const closeRef = useRef<HTMLButtonElement>(null);
  const clip = clips[index];
  const last = index === clips.length - 1;
  const total = clips.reduce((sum, c) => sum + c.duration, 0);
  const base = `${import.meta.env.BASE_URL}walkthrough/${language}/${clip.id}`;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function next() {
    if (last) onClose();
    else setIndex(index + 1);
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="howto-title">
      <div className="tour-scrim" onClick={onClose} />
      <div className="howto">
        <div className="howto-player">
          <video
            key={clip.id}
            className="howto-video"
            src={`${base}.mp4`}
            poster={`${base}.jpg`}
            autoPlay
            muted
            playsInline
            controls
            onEnded={() => !last && setIndex(index + 1)}
          />
          <p className="howto-now">
            {index + 1} · {clip.title}
          </p>
        </div>
        <div className="howto-side">
          <p className="howto-title" id="howto-title">
            {heading ?? t('tour.videosTitle')}
          </p>
          <p className="howto-length">
            {heading ? `${t('tour.videosTitle')} · ` : ''}
            {formatDuration(total)}
          </p>
          <ol className="howto-list">
            {clips.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={i === index ? 'howto-chapter howto-chapter-on' : 'howto-chapter'}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                >
                  <span>
                    {i === index && <span aria-hidden="true">▶ </span>}
                    {i + 1}. {c.title}
                  </span>
                  <span className="howto-chapter-time">{formatDuration(c.duration)}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="tour-actions">
            <button type="button" className="tour-skip" ref={closeRef} onClick={onClose}>
              {t('layout.close')}
            </button>
            <button type="button" className="btn btn-primary" onClick={next}>
              {last ? t('tour.finish') : `${t('tour.next')} ›`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
