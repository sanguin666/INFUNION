import { colors, isAccentName, type AccentName } from './theme';
import type { Poi, PoiType } from '../api/types';

/**
 * Per-POI-type visual theme: accent color, soft tint, and wording. This
 * layers on top of the base accessibility theme (theme.ts) — it never
 * changes text size, contrast ratios, or touch target sizing, only brand
 * color and imagery. Church is the only type today; add more entries here
 * as new kinds of POIs are supported (see PoiType in api/types.ts and
 * PoiType in the backend).
 */
export type PoiTheme = {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentText: string;
  label: string;
};

// Functions rather than values so the accent follows light / dark mode.
const POI_THEMES: Partial<Record<PoiType, () => PoiTheme>> = {
  church: () => ({
    accent: colors.primary,
    accentStrong: colors.primaryStrong,
    accentSoft: colors.primarySoft,
    accentText: colors.primaryText,
    label: 'Church',
  }),
};

/** The accent a place picked in the admin, or infunion's purple. */
export function poiAccent(poi: Pick<Poi, 'theme'>): AccentName {
  return isAccentName(poi.theme) ? poi.theme : 'purple';
}

export function getPoiTheme(type: PoiType): PoiTheme {
  // The accent tokens already carry the place's own theme (App applies it
  // on the way in), so every kind reads them; the map is where the kinds
  // get their own colours (theme/placeKinds.ts).
  return (POI_THEMES[type] ?? POI_THEMES.church!)();
}
