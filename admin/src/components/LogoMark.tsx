import { WORDMARK_HEIGHT, WORDMARK_PARTS, WORDMARK_TRANSFORM, WORDMARK_UNDERLINE, WORDMARK_WIDTH } from './brandArt';

// The infunion logo (Seb, 26 Oct 2026): a purple and a yellow ring linked
// like a chain, and the lowercase wordmark with "fun" in purple. Fixed
// brand colours, never themed. Mirrored in app/src/components/Logo.tsx.
export const LOGO_PURPLE = '#6C4FD9';
export const LOGO_YELLOW = '#F9B800';
export const LOGO_INK = '#1D1A2D';

// One ring: a rounded oval, flat along the top and bottom, centred on 0,0.
// The mark is 120 × 70 with the rings centred at x 38 and 81, y 35.
export const LOGO_RING = 'M-7 -29 L7 -29 A25 29 0 0 1 32 0 A25 29 0 0 1 7 29 L-7 29 A25 29 0 0 1 -32 0 A25 29 0 0 1 -7 -29 Z';
const RING_STROKE = 10.5;

/**
 * The two rings as SVG children. The yellow ring is drawn in two halves,
 * the lower one under the purple ring and the upper one over it, so the
 * rings pass over and under each other where they cross.
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
  const yellow = (
    <path d={LOGO_RING} fill="none" stroke={LOGO_YELLOW} strokeWidth={RING_STROKE} transform={`translate(${yellowX} 35)`} />
  );
  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={`${idPrefix}-low`}>
          <rect x={-200} y={34} width={600} height={100} />
        </clipPath>
        <clipPath id={`${idPrefix}-high`}>
          <rect x={-200} y={-100} width={600} height={136} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idPrefix}-low)`}>{yellow}</g>
      <path
        d={LOGO_RING}
        fill="none"
        stroke={onDark ? '#FFFFFF' : LOGO_PURPLE}
        strokeWidth={RING_STROKE}
        transform={`translate(${purpleX} 35)`}
      />
      <g clipPath={`url(#${idPrefix}-high)`}>{yellow}</g>
    </g>
  );
}

/** The rings alone. `size` is the height; the mark is 12:7. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={(size * 120) / 70} height={size} viewBox="0 0 120 70" role="img" aria-label="infunion">
      <Rings idPrefix={`mark${size}`} />
    </svg>
  );
}

/** The wordmark as children of a 258 × 80 drawing; `dot` and `underline` (0–1) animate it. */
export function WordmarkArt({ onDark = false, dot = 1, underline = 1 }: { onDark?: boolean; dot?: number; underline?: number }) {
  const fill = { ink: onDark ? '#FFFFFF' : LOGO_INK, purple: onDark ? '#FFFFFF' : LOGO_PURPLE, yellow: LOGO_YELLOW };
  return (
    <g transform={WORDMARK_TRANSFORM}>
      {WORDMARK_PARTS.map((part, i) => (
        <path
          key={i}
          d={part.d}
          fill={fill[part.role]}
          opacity={i === 1 && dot <= 0 ? 0 : 1}
          transform={`translate(${part.x} ${i === 1 ? 500 * (1 - dot) : 0})`}
        />
      ))}
      <rect
        x={WORDMARK_UNDERLINE.x}
        y={WORDMARK_UNDERLINE.y}
        width={WORDMARK_UNDERLINE.width * underline}
        height={WORDMARK_UNDERLINE.height}
        fill={LOGO_YELLOW}
      />
    </g>
  );
}

export function Wordmark({ height = 32, onDark = false }: { height?: number; onDark?: boolean }) {
  return (
    <svg
      width={(height * WORDMARK_WIDTH) / WORDMARK_HEIGHT}
      height={height}
      viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
      role="img"
      aria-label="infunion"
    >
      <WordmarkArt onDark={onDark} />
    </svg>
  );
}

/** Rings and wordmark side by side, 392 × 80. */
export function Lockup({ height = 32, onDark = false }: { height?: number; onDark?: boolean }) {
  return (
    <svg width={(height * 392) / 80} height={height} viewBox="0 0 392 80" role="img" aria-label="infunion">
      <Rings onDark={onDark} idPrefix={`lockup${height}`} />
      <g transform="translate(133 0)">
        <WordmarkArt onDark={onDark} />
      </g>
    </svg>
  );
}
