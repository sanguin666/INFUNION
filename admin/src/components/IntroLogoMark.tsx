import { useEffect, useState } from 'react';

/**
 * The INFUNION mark, arriving the way the app opens (Seb, 30 Sep 2026): a
 * whole coral heart and a whole gold heart come in from either side and
 * meet along a straight line; once they have joined, the line bends into
 * the S while the S draws itself. Drawn frame by frame, since the clip's
 * outline itself changes shape. Keep the beats in step with the app's
 * `app/src/components/IntroAnimation.tsx`.
 *
 * `delay` holds the hearts back while the page around them arrives;
 * `skip` jumps straight to the finished mark.
 */

const TRAVEL = 62;
const SLIDE = 1100;
const BEND = 500;
/** How long the mark takes, from its start to the finished logo. */
export const INTRO_MARK_DURATION = 100 + SLIDE + BEND;

const S_LENGTH = 87;
const HEART =
  'M50 20 C49 13 43 5 32 5 C20 5 9 13 9 27 C9 42 22 62 50 84 C78 62 91 42 91 27 C91 13 80 5 68 5 C57 5 51 13 50 20 Z';
const S = 'M50 20 C34 35 34 52 50 52 C66 52 66 69 50 84';

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

const slide = bezier(0.3, 0, 0.2, 1);
const bend = bezier(0.4, 0, 0.2, 1);
const easeOut = (x: number) => 1 - (1 - x) ** 3;

function progress(t: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

/** Everything on one side of the seam: a straight line at k = 0, the S at 1. */
function sideClip(side: 'left' | 'right', k: number) {
  const a = 50 - 16 * k;
  const b = 50 + 16 * k;
  const far = side === 'left' ? -400 : 500;
  return `M${far} -100 L50 -100 L50 20 C${a} 35 ${a} 52 50 52 C${b} 52 ${b} 69 50 84 L50 300 L${far} 300 Z`;
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

  const offset = TRAVEL * (1 - slide(progress(t, 100, 100 + SLIDE)));
  const k = bend(progress(t, 100 + SLIDE, INTRO_MARK_DURATION));
  const drawn = easeOut(progress(t, 100 + SLIDE, INTRO_MARK_DURATION));
  const opacity = progress(t, 0, 150);

  // 220 units wide so the hearts have room to start apart; the mark is
  // the middle 100, the same size as the still logo it replaces.
  return (
    <svg
      width={size * 2.2}
      height={size}
      viewBox="-60 0 220 100"
      role="img"
      aria-label="INFUNION"
      className="intro-mark"
    >
      <defs>
        <clipPath id="intro-left">
          <path d={sideClip('left', k)} />
        </clipPath>
        <clipPath id="intro-right">
          <path d={sideClip('right', k)} />
        </clipPath>
      </defs>
      <g clipPath="url(#intro-left)" opacity={opacity}>
        <path d={HEART} fill="#E1663F" transform={`translate(${-offset} 0)`} />
      </g>
      <g clipPath="url(#intro-right)" opacity={opacity}>
        <path d={HEART} fill="#E0A458" transform={`translate(${offset} 0)`} />
      </g>
      {drawn > 0 && (
        <path
          d={S}
          fill="none"
          stroke="#F7F1E7"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${S_LENGTH} ${S_LENGTH}`}
          strokeDashoffset={S_LENGTH * (1 - drawn)}
        />
      )}
    </svg>
  );
}
