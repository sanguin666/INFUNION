import Svg, { ClipPath, Defs, G, Path, Rect, Circle } from 'react-native-svg';
import { colors } from '../theme/theme';
import { LOCKUP_HEIGHT, LOCKUP_WIDTH, WORDMARK_LEFT, WORDMARK_PARTS, WORDMARK_RIGHT, WORDMARK_UNDERLINE } from './brandArt';

// The infunion logo, from Seb's logo kit (3 Nov 2026): a purple and a
// yellow circle linked like a chain, and the lowercase Montserrat Bold
// wordmark with "fun" in purple and a rounded yellow line under "union".
// Fixed brand colours, never themed. Mirrored in
// admin/src/components/LogoMark.tsx.
export const LOGO_PURPLE = '#6C4FD9';
// The kit's light purple, only on dark backgrounds.
export const LOGO_PURPLE_ON_DARK = '#A895F2';
export const LOGO_YELLOW = '#F9B800';
export const LOGO_INK = '#1D1A2D';
/** The kit's slogan. */
export const LOGO_CLAIM = 'La unión que te hace comunidad';

// The rings, in the kit's lockup drawing: two circles of radius 48.6 and
// stroke 15.6, centred at x 56.4 and 126.86, y 56.4.
export const RING_LEFT_X = 56.4;
export const RING_RIGHT_X = 126.86;
const RING_Y = 56.4;
const RING_R = 48.6;
const RING_STROKE = 15.6;
/** The rings alone are this wide (and LOCKUP_HEIGHT high). */
export const MARK_WIDTH = 183.26;

/**
 * The two rings as SVG children, for a mark or an animation. The purple
 * ring is drawn under the yellow one, then its lower half again on top, so
 * the rings pass over and under each other where they cross.
 * `purpleX`/`yellowX` move the rings apart for the intro; `idPrefix`
 * keeps clip ids unique when several marks share a page.
 */
export function Rings({
  purpleX = RING_LEFT_X,
  yellowX = RING_RIGHT_X,
  opacity = 1,
  onDark = false,
  idPrefix = 'logo',
}: {
  purpleX?: number;
  yellowX?: number;
  opacity?: number;
  onDark?: boolean;
  idPrefix?: string;
}) {
  const purple = onDark ? LOGO_PURPLE_ON_DARK : LOGO_PURPLE;
  const purpleRing = (clip?: string) => (
    <Circle cx={purpleX} cy={RING_Y} r={RING_R} fill="none" stroke={purple} strokeWidth={RING_STROKE} clipPath={clip} />
  );
  return (
    <G opacity={opacity}>
      <Defs>
        <ClipPath id={`${idPrefix}-low`}>
          <Rect x={-400} y={RING_Y} width={1200} height={200} />
        </ClipPath>
      </Defs>
      {purpleRing()}
      <Circle cx={yellowX} cy={RING_Y} r={RING_R} fill="none" stroke={LOGO_YELLOW} strokeWidth={RING_STROKE} />
      {purpleRing(`url(#${idPrefix}-low)`)}
    </G>
  );
}

/** The rings alone. `size` is the height. */
export function LogoMark({ size = 40, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <Svg
      width={(size * MARK_WIDTH) / LOCKUP_HEIGHT}
      height={size}
      viewBox={`0 0 ${MARK_WIDTH} ${LOCKUP_HEIGHT}`}
      accessibilityLabel="infunion"
    >
      <Rings onDark={onDark} idPrefix={`mark${size}`} />
    </Svg>
  );
}

/**
 * The wordmark as children of the lockup drawing (it sits right of the
 * rings). `dot` (0–1) drops the first i's dot into place, `underline`
 * (0–1) draws the line under "union" from the left; both default to the
 * finished logo.
 */
export function WordmarkArt({
  onDark = false,
  themed = false,
  dot = 1,
  underline = 1,
}: {
  onDark?: boolean;
  /** Follow the light or dark theme instead of the fixed brand ink. */
  themed?: boolean;
  dot?: number;
  underline?: number;
}) {
  const ink = themed ? colors.logoInk : LOGO_INK;
  const fun = themed ? colors.logoFun : LOGO_PURPLE;
  const fill = { ink: onDark ? '#FFFFFF' : ink, purple: onDark ? LOGO_PURPLE_ON_DARK : fun };
  return (
    <G>
      {WORDMARK_PARTS.map((part, i) => (
        <Path
          key={i}
          d={part.d}
          fill={fill[part.role]}
          opacity={i === 1 ? (dot > 0 ? 1 : 0) : 1}
          transform={i === 1 ? `translate(0 ${-42 * (1 - dot)})` : undefined}
        />
      ))}
      <Rect
        x={WORDMARK_UNDERLINE.x}
        y={WORDMARK_UNDERLINE.y}
        width={WORDMARK_UNDERLINE.width * underline}
        height={WORDMARK_UNDERLINE.height}
        rx={WORDMARK_UNDERLINE.height / 2}
        fill={LOGO_YELLOW}
      />
    </G>
  );
}

/** The wordmark alone. `height` sets the size. */
export function Wordmark({ height = 40, onDark = false }: { height?: number; onDark?: boolean }) {
  const width = WORDMARK_RIGHT - WORDMARK_LEFT;
  return (
    <Svg
      width={(height * width) / LOCKUP_HEIGHT}
      height={height}
      viewBox={`${WORDMARK_LEFT} 0 ${width} ${LOCKUP_HEIGHT}`}
      accessibilityLabel="infunion"
    >
      <WordmarkArt onDark={onDark} themed />
    </Svg>
  );
}

/** Rings and wordmark side by side, as in the kit. */
export function Lockup({ height = 48, onDark = false }: { height?: number; onDark?: boolean }) {
  return (
    <Svg
      width={(height * LOCKUP_WIDTH) / LOCKUP_HEIGHT}
      height={height}
      viewBox={`0 0 ${LOCKUP_WIDTH} ${LOCKUP_HEIGHT}`}
      accessibilityLabel="infunion"
    >
      <Rings onDark={onDark} idPrefix={`lockup${height}`} />
      <WordmarkArt onDark={onDark} themed />
    </Svg>
  );
}
