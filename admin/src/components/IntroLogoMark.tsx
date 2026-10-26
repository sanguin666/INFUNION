import { useEffect, useState } from 'react';
import { LOGO_CORAL, LOGO_GOLD, LOGO_U } from './LogoMark';

/**
 * The INFUNION mark, arriving the way the app opens (Seb, 26 Oct 2026,
 * option C): the two halves of the gold u slide in from either side and
 * meet, then the coral i lands in the middle. Keep the beats in step with
 * the app's `app/src/components/IntroAnimation.tsx`.
 *
 * `delay` holds the mark back while the page around it arrives;
 * `skip` jumps straight to the finished mark.
 */

const TRAVEL = 40;
const I_DROP = 14;
const HALVES_DONE = 400;
const I_IN = 300;
const I_DONE = 600;
/** How long the mark takes, from its start to the finished logo. */
export const INTRO_MARK_DURATION = I_DONE;

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

const slide = bezier(0.3, 0.7, 0.3, 1);
const easeOut = (x: number) => 1 - (1 - x) ** 3;

function progress(t: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

export function IntroLogoMark({ size = 180, delay = 0, skip = false }: { size?: number; delay?: number; skip?: boolean }) {
  const [clock, setClock] = useState(0);
  const t = skip ? Infinity : clock;

  useEffect(() => {
    if (skip) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start - delay;
      setClock(elapsed);
      if (elapsed < INTRO_MARK_DURATION) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [skip, delay]);

  const halves = slide(progress(t, 0, HALVES_DONE));
  const offset = TRAVEL * (1 - halves);
  const i = easeOut(progress(t, I_IN, I_DONE));

  // 180 units wide so the halves have room to start apart; the mark is
  // the middle 100, the same size as the still logo it replaces.
  return (
    <svg
      width={size * 1.8}
      height={size}
      viewBox="-40 0 180 100"
      role="img"
      aria-label="INFUNION"
      className="intro-mark"
    >
      <defs>
        <clipPath id="intro-left">
          <rect x={-100} y={0} width={150.3} height={100} />
        </clipPath>
        <clipPath id="intro-right">
          <rect x={49.7} y={0} width={150} height={100} />
        </clipPath>
      </defs>
      <g opacity={halves} transform={`translate(${-offset} 0)`}>
        <path d={LOGO_U} fill="none" stroke={LOGO_GOLD} strokeWidth={12} clipPath="url(#intro-left)" />
      </g>
      <g opacity={halves} transform={`translate(${offset} 0)`}>
        <path d={LOGO_U} fill="none" stroke={LOGO_GOLD} strokeWidth={12} clipPath="url(#intro-right)" />
      </g>
      <g opacity={i} transform={`translate(0 ${-I_DROP * (1 - i)})`}>
        <circle cx={50} cy={20} r={7.5} fill={LOGO_CORAL} />
        <path d="M50 36 L50 64" stroke={LOGO_CORAL} strokeWidth={12} strokeLinecap="round" />
      </g>
    </svg>
  );
}
