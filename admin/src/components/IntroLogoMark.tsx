import { useEffect, useState } from 'react';
import { LOCKUP_HEIGHT, LOCKUP_WIDTH } from './brandArt';
import { RING_LEFT_X, RING_RIGHT_X, Rings, WordmarkArt } from './LogoMark';

/**
 * The infunion logo arriving the way the app opens (Seb, 26 Oct 2026,
 * option A, "slide and link"): the two rings slide in from either side and
 * link, the wordmark rises in, the dot drops onto the i and the line
 * sweeps under "union". Keep the beats in step with the app's
 * `app/src/components/IntroAnimation.tsx`.
 *
 * `delay` holds the logo back while the page around it arrives;
 * `skip` jumps straight to the finished logo.
 */

// How far out each ring starts, in the logo's own units.
const TRAVEL = 42;
const DRAWING_WIDTH = LOCKUP_WIDTH + 2 * TRAVEL;
const RINGS_DONE = 380;
const WORD_IN = 350;
const WORD_DONE = 600;
const DOT_IN = 500;
const DOT_DONE = 680;
const LINE_IN = 580;
const LINE_DONE = 820;
/** How long the logo takes, from its start to the finished lockup. */
export const INTRO_MARK_DURATION = LINE_DONE;

const easeOut = (x: number) => 1 - (1 - x) ** 3;
const settle = (x: number) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;

function progress(t: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

export function IntroLogoMark({ height = 64, delay = 0, skip = false }: { height?: number; delay?: number; skip?: boolean }) {
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

  const rings = easeOut(progress(t, 0, RINGS_DONE));
  const word = easeOut(progress(t, WORD_IN, WORD_DONE));
  const dot = settle(progress(t, DOT_IN, DOT_DONE));
  const line = easeOut(progress(t, LINE_IN, LINE_DONE));

  // The drawing is wider than the lockup so the rings have room to start
  // apart.
  return (
    <svg
      width={(height * DRAWING_WIDTH) / LOCKUP_HEIGHT}
      height={height}
      viewBox={`${-TRAVEL} 0 ${DRAWING_WIDTH} ${LOCKUP_HEIGHT}`}
      role="img"
      aria-label="infunion"
      className="intro-mark"
    >
      <Rings purpleX={RING_LEFT_X - TRAVEL * (1 - rings)} yellowX={RING_RIGHT_X + TRAVEL * (1 - rings)} opacity={rings} idPrefix="intro" />
      <g opacity={word} transform={`translate(0 ${11 * (1 - word)})`}>
        <WordmarkArt dot={t >= DOT_IN ? dot : 0} underline={line} />
      </g>
    </svg>
  );
}
