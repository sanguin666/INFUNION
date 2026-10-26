import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Easing, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';
import { AccessibleText } from './AccessibleText';
import { colors } from '../theme/theme';

/**
 * The opening Seb picked (30 Sep 2026): a whole coral heart and a whole
 * gold heart come in from either side and meet along a straight line;
 * only once they have joined does that line bend into the S, while the
 * S draws itself; then INFUNION appears under the mark and the whole thing
 * fades into the app underneath.
 *
 * Drawn frame by frame from one clock rather than with Animated, because
 * the clip's outline itself changes shape and react-native-svg can't
 * animate a path's `d` natively. It is a few hundred small frames once
 * per launch. A tap skips it, and it never plays for somebody who has
 * asked their phone to reduce motion.
 */

// Timeline, in milliseconds. The same beats as the admin's login page.
const HEARTS_IN = 100;
const HEARTS_MEET = 1200; // hearts arrive; the seam starts to bend
const S_DONE = 1700;
const WORD_IN = 1750;
const WORD_DONE = 2150;
const FADE_OUT = 2700;
const END = 3000;

// How far out each heart starts, in the mark's own units (it is 100 wide).
const TRAVEL = 62;
// Length of the S stroke below, for drawing it with a dash.
const S_LENGTH = 87;

const HEART =
  'M50 20 C49 13 43 5 32 5 C20 5 9 13 9 27 C9 42 22 62 50 84 C78 62 91 42 91 27 C91 13 80 5 68 5 C57 5 51 13 50 20 Z';
const S = 'M50 20 C34 35 34 52 50 52 C66 52 66 69 50 84';

const slide = Easing.bezier(0.3, 0, 0.2, 1);
const bend = Easing.bezier(0.4, 0, 0.2, 1);
const easeOut = Easing.out(Easing.cubic);

function progress(t: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

/**
 * Everything on one side of the seam, as a clip. `k` = 0 is a straight
 * vertical line through the middle of the mark, `k` = 1 the S the two
 * halves share in the logo.
 */
function sideClip(side: 'left' | 'right', k: number) {
  const a = 50 - 16 * k; // 34 in the S
  const b = 50 + 16 * k; // 66 in the S
  const far = side === 'left' ? -400 : 500;
  return `M${far} -100 L50 -100 L50 20 C${a} 35 ${a} 52 50 52 C${b} 52 ${b} 69 50 84 L50 300 L${far} 300 Z`;
}

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(0);
  const finished = useRef(false);
  const { width } = useWindowDimensions();

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

  // The drawing is 230 units wide so the hearts have room to start apart;
  // the mark itself is the middle 100.
  const scale = Math.min(1.6, (width - 16) / 230);
  const offset = TRAVEL * (1 - slide(progress(t, HEARTS_IN, HEARTS_MEET)));
  const k = bend(progress(t, HEARTS_MEET, S_DONE));
  const drawn = easeOut(progress(t, HEARTS_MEET, S_DONE));
  const heartsOpacity = progress(t, 0, 150);
  const word = easeOut(progress(t, WORD_IN, WORD_DONE));
  const opacity = 1 - progress(t, FADE_OUT, END);

  return (
    <Pressable
      onPress={finish}
      accessibilityRole="image"
      accessibilityLabel="INFUNION"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background, opacity }]}
    >
      <Svg width={230 * scale} height={90 * scale} viewBox="-65 0 230 90">
        <Defs>
          <ClipPath id="introLeft">
            <Path d={sideClip('left', k)} />
          </ClipPath>
          <ClipPath id="introRight">
            <Path d={sideClip('right', k)} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#introLeft)" opacity={heartsOpacity}>
          <Path d={HEART} fill="#E1663F" transform={`translate(${-offset} 0)`} />
        </G>
        <G clipPath="url(#introRight)" opacity={heartsOpacity}>
          <Path d={HEART} fill="#E0A458" transform={`translate(${offset} 0)`} />
        </G>
        {drawn > 0 && (
          <Path
            d={S}
            fill="none"
            stroke="#F7F1E7"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${S_LENGTH} ${S_LENGTH}`}
            strokeDashoffset={S_LENGTH * (1 - drawn)}
          />
        )}
      </Svg>
      <AccessibleText
        variant="title"
        style={[styles.wordmark, { opacity: word, transform: [{ translateY: 8 * (1 - word) }] }]}
      >
        INFUNION
      </AccessibleText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: 5,
    fontSize: 34,
    marginTop: 8,
  },
});
