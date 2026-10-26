// The INFUNION mark (Seb, 26 Oct 2026): a coral i held inside a gold u, each
// person held by the union. Fixed brand colors — not themeable. Keep in step
// with the app's `LogoMark` in app/src/components/icons.tsx.
export const LOGO_U = 'M18 12 L18 52 A32 32 0 0 0 82 52 L82 12';
export const LOGO_GOLD = '#E0A458';
export const LOGO_CORAL = '#E1663F';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="INFUNION">
      <path d={LOGO_U} fill="none" stroke={LOGO_GOLD} strokeWidth={12} />
      <circle cx={50} cy={20} r={7.5} fill={LOGO_CORAL} />
      <path d="M50 36 L50 64" stroke={LOGO_CORAL} strokeWidth={12} strokeLinecap="round" />
    </svg>
  );
}
