import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/theme';
import { WORDMARK_HEIGHT, WORDMARK_PARTS, WORDMARK_TRANSFORM, WORDMARK_UNDERLINE, WORDMARK_WIDTH } from './brandArt';

// The infunion logo (Seb, 26 Oct 2026): a purple and a yellow ring linked
// like a chain, and the lowercase wordmark with "fun" in purple. Fixed
// brand colours, never themed. Mirrored in admin/src/components/LogoMark.tsx.
export const LOGO_PURPLE = '#6C4FD9';
export const LOGO_YELLOW = '#F9B800';
export const LOGO_INK = '#1D1A2D';

// One ring: a rounded oval, flat along the top and bottom, centred on 0,0.
// The mark is 120 × 70 with the rings centred at x 38 and 81, y 35.
export const LOGO_RING = 'M-7 -29 L7 -29 A25 29 0 0 1 32 0 A25 29 0 0 1 7 29 L-7 29 A25 29 0 0 1 -32 0 A25 29 0 0 1 -7 -29 Z';
const RING_STROKE = 10.5;

/**
 * The two rings as SVG children, for a mark or an animation. The yellow
 * ring is drawn in two halves, the lower one under the purple ring and the
 * upper one over it, so the rings pass over and under each other where
 * they cross. `purpleX`/`yellowX` move the rings apart for the intro;
 * `idPrefix` keeps clip ids unique when several marks share a page.
 */
export function Rings({
  purpleX = 38,
  yellowX = 81,
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
  const purple = onDark ? '#FFFFFF' : LOGO_PURPLE;
  const yellow = (
    <Path d={LOGO_RING} fill="none" stroke={LOGO_YELLOW} strokeWidth={RING_STROKE} transform={`translate(${yellowX} 35)`} />
  );
  return (
    <G opacity={opacity}>
      <Defs>
        <ClipPath id={`${idPrefix}-low`}>
          <Rect x={-200} y={34} width={600} height={100} />
        </ClipPath>
        <ClipPath id={`${idPrefix}-high`}>
          <Rect x={-200} y={-100} width={600} height={136} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${idPrefix}-low)`}>{yellow}</G>
      <Path d={LOGO_RING} fill="none" stroke={purple} strokeWidth={RING_STROKE} transform={`translate(${purpleX} 35)`} />
      <G clipPath={`url(#${idPrefix}-high)`}>{yellow}</G>
    </G>
  );
}

/** The rings alone. `size` is the height; the mark is 12:7. */
export function LogoMark({ size = 40, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <Svg width={(size * 120) / 70} height={size} viewBox="0 0 120 70" accessibilityLabel="infunion">
      <Rings onDark={onDark} idPrefix={`mark${size}`} />
    </Svg>
  );
}

/**
 * The wordmark as children of a 258 × 80 drawing. `dot` (0–1) drops the
 * first i's yellow dot into place, `underline` (0–1) draws the line under
 * "union" from the left; both default to the finished logo.
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
  const fill = { ink: onDark ? '#FFFFFF' : ink, purple: onDark ? '#FFFFFF' : fun, yellow: LOGO_YELLOW };
  return (
    <G transform={WORDMARK_TRANSFORM}>
      {WORDMARK_PARTS.map((part, i) => (
        <Path
          key={i}
          d={part.d}
          fill={fill[part.role]}
          opacity={i === 1 ? (dot > 0 ? 1 : 0) : 1}
          transform={`translate(${part.x} ${i === 1 ? 500 * (1 - dot) : 0})`}
        />
      ))}
      <Rect
        x={WORDMARK_UNDERLINE.x}
        y={WORDMARK_UNDERLINE.y}
        width={WORDMARK_UNDERLINE.width * underline}
        height={WORDMARK_UNDERLINE.height}
        fill={LOGO_YELLOW}
      />
    </G>
  );
}

/** The wordmark alone. `height` sets the size; the drawing is 258:80. */
export function Wordmark({ height = 40, onDark = false }: { height?: number; onDark?: boolean }) {
  return (
    <Svg
      width={(height * WORDMARK_WIDTH) / WORDMARK_HEIGHT}
      height={height}
      viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
      accessibilityLabel="infunion"
    >
      <WordmarkArt onDark={onDark} themed />
    </Svg>
  );
}

/** Rings and wordmark side by side, 392 × 80. */
export function Lockup({ height = 48, onDark = false }: { height?: number; onDark?: boolean }) {
  return (
    <Svg width={(height * 392) / 80} height={height} viewBox="0 0 392 80" accessibilityLabel="infunion">
      <G transform="translate(0 0)">
        <Rings onDark={onDark} idPrefix={`lockup${height}`} />
      </G>
      <G transform="translate(133 0)">
        <WordmarkArt onDark={onDark} themed />
      </G>
    </Svg>
  );
}
