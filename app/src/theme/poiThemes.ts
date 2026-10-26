import { colors } from './theme';
import type { PoiType } from '../api/types';

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

export function getPoiTheme(type: PoiType): PoiTheme {
  // Every kind wears infunion's coral inside its own pages for now; the map
  // is where the kinds get their own colours (theme/placeKinds.ts).
  return (POI_THEMES[type] ?? POI_THEMES.church!)();
}
