import type { PoiType } from './api/types';

/**
 * The kinds of place and how the map of communities draws them (Seb, 18 Oct
 * 2026): one colour and one symbol each, so a pin reads without relying on
 * colour alone. Mirrored in app/src/theme/placeKinds.ts — keep both in step.
 */
export const PLACE_KINDS: PoiType[] = ['church', 'mosque', 'synagogue', 'other_worship', 'association', 'culture'];

export const PLACE_KIND_COLORS: Record<PoiType, string> = {
  church: '#B8502E',
  mosque: '#2E7D5B',
  synagogue: '#3557A8',
  other_worship: '#7A4FA0',
  association: '#9A6A08',
  culture: '#1F7A86',
};

// White symbols drawn on a 24×24 grid, inside the pin.
export const PLACE_KIND_SYMBOLS: Record<PoiType, string> = {
  church: '<path d="M10.5 3h3v5h5v3h-5v10h-3V11h-5V8h5z" fill="#fff"/>',
  mosque: '<path d="M14.5 3.2A9 9 0 1 0 20.8 16 7 7 0 1 1 14.5 3.2z" fill="#fff"/>',
  synagogue:
    '<path d="M12 3l7.8 13.5H4.2z M12 21L4.2 7.5h15.6z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  other_worship:
    '<path d="M12 2.5c1.2 4 6 6.3 6 11.5a6 6 0 0 1-12 0c0-3 1.7-5.2 3-6.8.2 2.6 1.2 3.9 2.8 4.6.3-3.4-.9-6.2.2-9.3z" fill="#fff"/>',
  association:
    '<path d="M12 20.5l-1.3-1.2C5.6 14.8 2.5 12 2.5 8.6 2.5 5.8 4.7 3.6 7.5 3.6c1.6 0 3.2.8 4.5 2 1.3-1.2 2.9-2 4.5-2 2.8 0 5 2.2 5 5 0 3.4-3.1 6.2-8.2 10.7z" fill="#fff"/>',
  culture: '<path d="M9 3.5v11a3.6 3.6 0 1 0 2.2 3.3V8.2h6.3V3.5z" fill="#fff"/>',
};

/** A map pin as an SVG string: a teardrop in the kind's colour. */
export function pinSvg(type: PoiType, size = 36): string {
  const color = PLACE_KIND_COLORS[type] ?? PLACE_KIND_COLORS.church;
  const symbol = PLACE_KIND_SYMBOLS[type] ?? PLACE_KIND_SYMBOLS.church;
  return `<svg width="${size}" height="${Math.round(size * 1.3)}" viewBox="0 0 36 47" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18 46C15 40 2 31 2 18a16 16 0 0 1 32 0c0 13-13 22-16 28z" fill="${color}" stroke="#fff" stroke-width="2.5"/><g transform="translate(8 8) scale(0.84)">${symbol}</g></svg>`;
}

/** A small round badge with the symbol, for lists and the type chips. */
export function dotSvg(type: PoiType, size = 20): string {
  const color = PLACE_KIND_COLORS[type] ?? PLACE_KIND_COLORS.church;
  const symbol = PLACE_KIND_SYMBOLS[type] ?? PLACE_KIND_SYMBOLS.church;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${color}"/><g transform="translate(4.8 4.8) scale(0.6)">${symbol}</g></svg>`;
}

// Free OpenStreetMap vector tiles, no key needed (openfreemap.org).
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
