import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Easing, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { AccessibleText } from './AccessibleText';
import { LOGO_CORAL, LOGO_GOLD, LOGO_I_STEM, LOGO_U } from './icons';
import { colors } from '../theme/theme';

/**
 * The opening Seb picked (26 Oct 2026, option C): the two halves of the
 * gold u slide in from either side and meet, the coral i lands in the
 * middle, then INFUNION appears under the mark and the whole thing fades
 * into the app underneath. One second in all.
 *
 * Drawn frame by frame from one clock, the same way as before. A tap skips
 * it, and it never plays for somebody who has asked their phone to reduce
 * motion.
 */

// Timeline, in milliseconds. The same beats as the admin's login page.
const HALVES_DONE = 400;
const I_IN = 300;
const I_DONE = 600;
const WORD_IN = 500;
const WORD_DONE = 750;
const FADE_OUT = 800;
const END = 1000;

// How far out each half starts, in the mark's own units (it is 100 wide).
const TRAVEL = 40;
// How far above its place the i starts.
const I_DROP = 14;

const slide = Easing.bezier(0.3, 0.7, 0.3, 1);
const easeOut = Easing.out(Easing.cubic);

function progress(t: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
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

  // The drawing is 180 units wide so the halves have room to start apart;
  // the mark itself is the middle 100.
  const scale = Math.min(1.6, (width - 16) / 180);
  const halves = slide(progress(t, 0, HALVES_DONE));
  const offset = TRAVEL * (1 - halves);
  const i = easeOut(progress(t, I_IN, I_DONE));
  const word = easeOut(progress(t, WORD_IN, WORD_DONE));
  const opacity = 1 - progress(t, FADE_OUT, END);

  return (
    <Pressable
      onPress={finish}
      accessibilityRole="image"
      accessibilityLabel="INFUNION"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background, opacity }]}
    >
      <Svg width={180 * scale} height={100 * scale} viewBox="-40 0 180 100">
        <Defs>
          <ClipPath id="introLeft">
            <Rect x={-100} y={0} width={150.3} height={100} />
          </ClipPath>
          <ClipPath id="introRight">
            <Rect x={49.7} y={0} width={150} height={100} />
          </ClipPath>
        </Defs>
        <G opacity={halves} transform={`translate(${-offset} 0)`}>
          <Path d={LOGO_U} fill="none" stroke={LOGO_GOLD} strokeWidth={12} clipPath="url(#introLeft)" />
        </G>
        <G opacity={halves} transform={`translate(${offset} 0)`}>
          <Path d={LOGO_U} fill="none" stroke={LOGO_GOLD} strokeWidth={12} clipPath="url(#introRight)" />
        </G>
        <G opacity={i} transform={`translate(0 ${-I_DROP * (1 - i)})`}>
          <Circle cx={50} cy={20} r={7.5} fill={LOGO_CORAL} />
          <Path d={LOGO_I_STEM} stroke={LOGO_CORAL} strokeWidth={12} strokeLinecap="round" />
        </G>
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
