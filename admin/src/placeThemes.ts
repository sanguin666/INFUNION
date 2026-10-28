import type { PoiThemeName } from './api/types';

/**
 * The accent themes a community can wear in the app (Seb, 28 Oct 2026).
 * The same colours as the app's ACCENTS (app/src/theme/theme.ts) and the
 * backend's PoiTheme: keep the three in step. `primary` fills the big
 * buttons, `strong` sits under white text and small coloured text.
 */
export const PLACE_THEMES: { name: PoiThemeName; primary: string; strong: string; soft: string }[] = [
  { name: 'purple', primary: '#6C4FD9', strong: '#5638C7', soft: '#ECE8FC' },
  { name: 'ocean', primary: '#1F6FD1', strong: '#1557A8', soft: '#E3EEFB' },
  { name: 'forest', primary: '#2E8B57', strong: '#1E6B41', soft: '#E2F3E9' },
  { name: 'terracotta', primary: '#D2602E', strong: '#A8461C', soft: '#FBEAE1' },
  { name: 'ruby', primary: '#C2185B', strong: '#A0124A', soft: '#FBE4EE' },
  { name: 'teal', primary: '#0F8A8A', strong: '#0B6B6B', soft: '#DDF3F2' },
  { name: 'graphite', primary: '#4A5263', strong: '#2F3542', soft: '#E8EAEE' },
];

export function placeTheme(name: string | null | undefined) {
  return PLACE_THEMES.find((theme) => theme.name === name) ?? PLACE_THEMES[0];
}

// Words too small to stand for a place in its initials.
const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'i', 'of', 'the', 'and', 'du', 'des', 'le', 'les', 'da', 'do', 'dos', 'das', 'a', 'o', 'en']);

/** What the app shows without a logo: "Crecer Juntos" → "CJ". Same rule as app/src/components/PlaceMark.tsx. */
export function placeInitials(name: string): string {
  const words = name.split(/[\s\-–—'’.]+/).filter(Boolean);
  const meaningful = words.filter((word) => !SMALL_WORDS.has(word.toLowerCase()));
  const picked = (meaningful.length > 0 ? meaningful : words).slice(0, 2);
  return picked.map((word) => [...word][0]?.toUpperCase() ?? '').join('');
}
