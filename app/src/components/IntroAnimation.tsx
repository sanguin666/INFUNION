import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Easing, Pressable, StyleSheet } from 'react-native';
import { useFrameDimensions } from '../web/desktopFrame';
import Svg, { G } from 'react-native-svg';
import { LOCKUP_HEIGHT, LOCKUP_WIDTH } from './brandArt';
import { RING_LEFT_X, RING_RIGHT_X, Rings, WordmarkArt } from './Logo';
import { colors } from '../theme/theme';

/**
 * The opening Seb picked (26 Oct 2026, option A, "slide and link"): the
 * purple and the yellow ring slide in from either side and link, then the
 * wordmark rises in, the dot drops onto the i and the line sweeps
 * under "union". Then the whole thing fades into the app underneath.
 *
 * Drawn frame by frame from one clock. A tap skips it, and it never plays
 * for somebody who has asked their phone to reduce motion.
 */

// Timeline, in milliseconds. The same beats as the admin's login page.
const RINGS_DONE = 380;
const WORD_IN = 350;
const WORD_DONE = 600;
const DOT_IN = 500;
const DOT_DONE = 680;
const LINE_IN = 580;
const LINE_DONE = 820;
const FADE_OUT = 850;
const END = 1100;

// How far out each ring starts, in the logo's own units (it is 651.52 wide).
const TRAVEL = 42;
const DRAWING_WIDTH = LOCKUP_WIDTH + 2 * TRAVEL;

const easeOut = Easing.out(Easing.cubic);
const settle = Easing.out(Easing.back(1.7));

function progress(t: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(0);
  const finished = useRef(false);
  const { width } = useFrameDimensions();

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          finish();
          return;
        }
        const tick = (now: number) => {
          if (start === null) start = now;
          const elapsed = now - start;
          setT(elapsed);
          if (elapsed >= END) finish();
          else frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  // The drawing is wider than the logo so the rings have room to start
  // apart. On a phone it is about as wide as the old 444-unit drawing.
  const scale = Math.min(444 / DRAWING_WIDTH, (width - 48) / DRAWING_WIDTH);
  const rings = easeOut(progress(t, 0, RINGS_DONE));
  const word = easeOut(progress(t, WORD_IN, WORD_DONE));
  const dot = settle(progress(t, DOT_IN, DOT_DONE));
  const line = easeOut(progress(t, LINE_IN, LINE_DONE));
  const opacity = 1 - progress(t, FADE_OUT, END);

  return (
    <Pressable
      onPress={finish}
      accessibilityRole="image"
      accessibilityLabel="infunion"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background, opacity }]}
    >
      <Svg
        width={DRAWING_WIDTH * scale}
        height={LOCKUP_HEIGHT * scale}
        viewBox={`${-TRAVEL} 0 ${DRAWING_WIDTH} ${LOCKUP_HEIGHT}`}
      >
        <Rings
          purpleX={RING_LEFT_X - TRAVEL * (1 - rings)}
          yellowX={RING_RIGHT_X + TRAVEL * (1 - rings)}
          opacity={rings}
          idPrefix="intro"
        />
        <G opacity={word} transform={`translate(0 ${11 * (1 - word)})`}>
          <WordmarkArt themed dot={t >= DOT_IN ? dot : 0} underline={line} />
        </G>
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
