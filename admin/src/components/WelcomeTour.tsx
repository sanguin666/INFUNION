import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { Translations } from '../i18n/translations';

type TourKey = `tour.${keyof Translations['tour']}`;
type Step = { target?: string; title: TourKey; text: TourKey };

// What the bubble points at: the sidebar rows carry data-tour (see
// DashboardLayout). Seb approved these six steps on 5 Nov 2026.
const STEPS: Step[] = [
  { title: 'tour.welcomeTitle', text: 'tour.welcomeText' },
  { target: 'dashboard', title: 'tour.dashboardTitle', text: 'tour.dashboardText' },
  { target: 'home-page', title: 'tour.homeTitle', text: 'tour.homeText' },
  { target: 'members', title: 'tour.membersTitle', text: 'tour.membersText' },
  { target: 'modules', title: 'tour.modulesTitle', text: 'tour.modulesText' },
  { target: 'setup', title: 'tour.setupTitle', text: 'tour.setupText' },
];

type Box = { top: number; left: number; width: number; height: number };

const GAP = 24;
const MARGIN = 16;

/**
 * The welcome tour, the first time someone signs in to a community's
 * admin (Seb, 5 Nov 2026): the screen dims, one part of the menu is lit,
 * and a bubble says what it is for. Skipping or finishing ends it for
 * good; Settings can show it again.
 */
export function WelcomeTour({
  firstName,
  communityName,
  onDone,
}: {
  firstName: string | null;
  communityName: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [bubble, setBubble] = useState<{ top: number; left: number; arrow: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const step: Step = STEPS[index];
  const last = index === STEPS.length - 1;

  const measure = useCallback(() => {
    const element = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    if (!element) {
      setBox(null);
      setBubble(null);
      return;
    }
    element.scrollIntoView({ block: 'nearest' });
    const r = element.getBoundingClientRect();
    const target = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
    setBox(target);
    const height = bubbleRef.current?.offsetHeight ?? 260;
    const width = bubbleRef.current?.offsetWidth ?? 360;
    // Beside the lit part, level with its first row, inside the window.
    const anchor = target.top + Math.min(target.height, 56) / 2;
    const top = Math.max(MARGIN, Math.min(anchor - 28, window.innerHeight - height - MARGIN));
    const left = Math.min(target.left + target.width + GAP, window.innerWidth - width - MARGIN);
    const arrow = Math.max(18, Math.min(anchor - top - 9, height - 36));
    setBubble({ top, left, arrow });
  }, [step.target]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const welcome = index === 0;
  const title = welcome
    ? firstName
      ? t('tour.welcomeTitle', { name: firstName })
      : t('tour.welcomeTitleNoName')
    : t(step.title);
  const text = welcome ? t('tour.welcomeText', { community: communityName }) : t(step.text);
  const centred = welcome || !box || !bubble;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      {centred ? (
        <div className="tour-scrim" />
      ) : (
        <div className="tour-spotlight" style={box!} />
      )}
      <div
        ref={bubbleRef}
        className={centred ? 'tour-bubble tour-bubble-centred' : 'tour-bubble'}
        style={
          centred
            ? undefined
            : ({ top: bubble!.top, left: bubble!.left, '--tour-arrow': `${bubble!.arrow}px` } as React.CSSProperties)
        }
      >
        {!welcome && <p className="tour-step">{t('tour.step', { n: index + 1, total: STEPS.length })}</p>}
        <p className="tour-title" id="tour-title">
          {title}
        </p>
        <p className="tour-text" id="tour-text">
          {text}
        </p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onDone}>
            {welcome ? t('tour.notNow') : t('tour.skip')}
          </button>
          <span className="tour-moves">
            {!welcome && (
              <button type="button" className="text-action" onClick={() => setIndex(index - 1)}>
                {t('tour.back')}
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              className="btn btn-primary"
              onClick={() => (last ? onDone() : setIndex(index + 1))}
            >
              {welcome ? t('tour.start') : last ? t('tour.finish') : t('tour.next')}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
