import { LOCKUP_HEIGHT, LOCKUP_WIDTH, WORDMARK_LEFT, WORDMARK_PARTS, WORDMARK_RIGHT, WORDMARK_UNDERLINE } from './brandArt';

// The infunion logo, from Seb's logo kit (3 Nov 2026): a purple and a
// yellow circle linked like a chain, and the lowercase Montserrat Bold
// wordmark with "fun" in purple and a rounded yellow line under "union".
// Fixed brand colours, never themed. Mirrored in app/src/components/Logo.tsx.
export const LOGO_PURPLE = '#6C4FD9';
// The kit's light purple, only on dark backgrounds.
export const LOGO_PURPLE_ON_DARK = '#A895F2';
export const LOGO_YELLOW = '#F9B800';
export const LOGO_INK = '#1D1A2D';

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
 * The two rings as SVG children. The purple ring is drawn under the yellow
 * one, then its lower half again on top, so the rings pass over and under
 * each other where they cross.
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
  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={`${idPrefix}-low`}>
          <rect x={-400} y={RING_Y} width={1200} height={200} />
        </clipPath>
      </defs>
      <circle cx={purpleX} cy={RING_Y} r={RING_R} fill="none" stroke={purple} strokeWidth={RING_STROKE} />
      <circle cx={yellowX} cy={RING_Y} r={RING_R} fill="none" stroke={LOGO_YELLOW} strokeWidth={RING_STROKE} />
      <circle
        cx={purpleX}
        cy={RING_Y}
        r={RING_R}
        fill="none"
        stroke={purple}
        strokeWidth={RING_STROKE}
        clipPath={`url(#${idPrefix}-low)`}
      />
    </g>
  );
}

/** The rings alone. `size` is the height. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={(size * MARK_WIDTH) / LOCKUP_HEIGHT}
      height={size}
      viewBox={`0 0 ${MARK_WIDTH} ${LOCKUP_HEIGHT}`}
      role="img"
      aria-label="infunion"
    >
      <Rings idPrefix={`mark${size}`} />
    </svg>
  );
}

/** The wordmark as children of the lockup drawing; `dot` and `underline` (0–1) animate it. */
export function WordmarkArt({ onDark = false, dot = 1, underline = 1 }: { onDark?: boolean; dot?: number; underline?: number }) {
  // The letters follow the theme through --logo-ink / --logo-fun (lighter
  // in dark mode, see index.css); the brand colours are the fallback.
  const fill = {
    ink: onDark ? '#FFFFFF' : `var(--logo-ink, ${LOGO_INK})`,
    purple: onDark ? LOGO_PURPLE_ON_DARK : `var(--logo-fun, ${LOGO_PURPLE})`,
  };
  return (
    <g>
      {WORDMARK_PARTS.map((part, i) => (
        <path
          key={i}
          d={part.d}
          style={{ fill: fill[part.role] }}
          opacity={i === 1 && dot <= 0 ? 0 : 1}
          transform={i === 1 ? `translate(0 ${-42 * (1 - dot)})` : undefined}
        />
      ))}
      <rect
        x={WORDMARK_UNDERLINE.x}
        y={WORDMARK_UNDERLINE.y}
        width={WORDMARK_UNDERLINE.width * underline}
        height={WORDMARK_UNDERLINE.height}
        rx={WORDMARK_UNDERLINE.height / 2}
        fill={LOGO_YELLOW}
      />
    </g>
  );
}

export function Wordmark({ height = 32, onDark = false }: { height?: number; onDark?: boolean }) {
  const width = WORDMARK_RIGHT - WORDMARK_LEFT;
  return (
    <svg
      width={(height * width) / LOCKUP_HEIGHT}
      height={height}
      viewBox={`${WORDMARK_LEFT} 0 ${width} ${LOCKUP_HEIGHT}`}
      role="img"
      aria-label="infunion"
    >
      <WordmarkArt onDark={onDark} />
    </svg>
  );
}

/** Rings and wordmark side by side, as in the kit. */
export function Lockup({ height = 32, onDark = false }: { height?: number; onDark?: boolean }) {
  return (
    <svg
      width={(height * LOCKUP_WIDTH) / LOCKUP_HEIGHT}
      height={height}
      viewBox={`0 0 ${LOCKUP_WIDTH} ${LOCKUP_HEIGHT}`}
      role="img"
      aria-label="infunion"
    >
      <Rings onDark={onDark} idPrefix={`lockup${height}`} />
      <WordmarkArt onDark={onDark} />
    </svg>
  );
}
