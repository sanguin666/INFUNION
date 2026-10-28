/**
 * App-wide accessibility theme.
 *
 * The target audience is mostly elderly: the text sizes and touch targets
 * below are deliberately well above the usual minimums, and the contrasts
 * meet (or exceed) WCAG level AA. Don't go below these values without a
 * strong reason.
 */

import { StyleSheet } from 'react-native';

export type ColorScheme = 'light' | 'dark';

const lightColors = {
  // The app's canvas: a warm off-white, light enough to read as paper
  // rather than as a colour, but still a shade below the boxes on it.
  // That gap is small — about 1.09:1 against white — so `cardSurface`
  // below pairs every white box with a hairline, and the hairline is
  // what actually holds the edge on a phone in daylight. Going lighter
  // than this closes the gap to nothing, which is the state Seb turned
  // down once already.
  background: '#F6F5F9',
  // Boxes, sheets, buttons and the floating menus.
  //
  // THE RULE: only ever one white box deep. Whatever sits inside a white
  // card or sheet — a text field, a row, an option in a list — carries no
  // fill and no border of its own. It is told apart by a hairline in
  // `cardBorder`, by its colour, or by a tick; never by a frame, and
  // never by a patch of `background`, which would read as a box inside a
  // box. `FormCard` and `FormField` are this rule as components; use
  // them rather than rebuilding a form by hand.
  //
  // Actions are the exception, because a button is not a box: inside
  // white, use a filled button (`primary`, or `danger` for something
  // that undoes) or the `quiet` variant for the way out.
  surface: '#FFFFFF',
  text: '#1D1A2D',
  textMuted: '#4A4760',
  primary: '#6C4FD9',
  // Same hue as `primary`, darkened until it clears 4.5:1 on white — use
  // this instead of `primary` wherever the brand color is small text or a
  // small filled shape (a link, a small badge). `primary` itself only
  // reaches ~3.2:1 on white, which is fine for large/bold text (≥22px
  // bold, e.g. AccessibleButton's label) and for graphical elements (icons,
  // large fills), per WCAG's large-text and non-text contrast thresholds,
  // but not for anything smaller.
  primaryStrong: '#5638C7',
  // A filled shape carrying white text at body size (the "important"
  // tag, a selected day). The same dark coral as `primaryStrong` in light
  // mode; kept apart because in dark mode small orange *text* goes
  // lighter while a fill under white text must stay dark.
  primaryFill: '#5638C7',
  primaryText: '#FFFFFF',
  // A warm coral wash, for the one thing that is currently selected on a
  // white surface — the menu button you are on, the donation amount you
  // picked. Paired with a coral, bolded label, never carrying the meaning
  // on its own.
  primarySoft: '#ECE8FC',
  danger: '#B3261E',
  // Same split as `primaryFill`: red behind white text (the Live badge).
  dangerFill: '#B3261E',
  dangerText: '#FFFFFF',
  border: '#1D1A2D',
  // Hairline for the edge of a white card on the beige page. Warm rather
  // than grey so it reads as a shadow's edge instead of a drawn line.
  cardBorder: 'rgba(45,30,110,0.14)',
  focus: '#6C4FD9',
  // An off switch's track, and the dot of a closed office tile.
  switchOff: '#C8C5D4',
  quietDot: '#8F8AA3',
  // The dimmed page behind a sheet.
  scrim: 'rgba(17,17,17,0.45)',
  // The wordmark's letters and its "fun": brand ink and purple on the
  // light page, lighter on the dark one so the name stays readable.
  logoInk: '#1D1A2D',
  logoFun: '#6C4FD9',
};

export type Colors = { [K in keyof typeof lightColors]: string };

/**
 * Dark mode, "warm dark": the beige page and white boxes become a dark
 * brown page and a lighter brown box, so the app keeps its warmth rather
 * than turning into a grey settings screen. The one-box rule, the
 * hairline and the orange buttons are all unchanged; only small orange
 * and red *text* goes lighter, because the light-mode shades don't reach
 * 4.5:1 on a dark box. Every text pair here clears AA on `surface`.
 */
const darkColors: Colors = {
  background: '#13111C',
  surface: '#221E31',
  text: '#F3F1FA',
  textMuted: '#C9C4DA',
  primary: '#6C4FD9',
  primaryStrong: '#B3A3F7',
  primaryFill: '#5638C7',
  primaryText: '#FFFFFF',
  primarySoft: '#332A5C',
  danger: '#FF8A80',
  dangerFill: '#B3261E',
  dangerText: '#FFFFFF',
  // The heavy edge of the secondary and destructive buttons: black on
  // the light page, so near-white here.
  border: '#F3F1FA',
  cardBorder: 'rgba(220,210,255,0.16)',
  focus: '#B3A3F7',
  switchOff: '#5F5A75',
  quietDot: '#A49FB8',
  scrim: 'rgba(0,0,0,0.6)',
  logoInk: '#F3F1FA',
  logoFun: '#B3A3F7',
};

const palettes: Record<ColorScheme, Colors> = { light: lightColors, dark: darkColors };

/**
 * The colours of the scheme on screen. This object is swapped in place
 * by `applyColorScheme`, so reading `colors.text` at render time always
 * gives the current one. Styles built once at load time would keep the
 * old colours: build them with `themedStyles` instead of
 * `StyleSheet.create`.
 */
export const colors: Colors = { ...lightColors };

/**
 * Every white box on the page: the fill plus the hairline that makes its
 * edge visible. The page is only just off white, so a box without this
 * has no edge at all — spread it instead of setting `backgroundColor`.
 */
export const cardSurface = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.cardBorder,
};

/**
 * The shadow under the two floating menus. Both platforms need their own
 * half of this: `elevation` is Android's, the rest is iOS's.
 */
export const floatingShadow = {
  shadowColor: '#2A1F5A',
  shadowOpacity: 0.16,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 8,
};

/**
 * A community's accent (Seb, 28 Oct 2026): the theme its admin picked,
 * worn on its own pages. Only the accent tokens change, so the page, the
 * boxes, the text and every contrast stay as they are. Each has the
 * same split as the default: `primary` for big fills and icons,
 * `primaryStrong` for small text (lighter in dark mode), `primaryFill`
 * under white text (dark in both), `primarySoft` for the selected wash.
 * The names match the backend's PoiTheme and the admin's picker.
 */
export type AccentName = 'purple' | 'ocean' | 'forest' | 'terracotta' | 'ruby' | 'teal' | 'graphite';

type Accent = Pick<Colors, 'primary' | 'primaryStrong' | 'primaryFill' | 'primarySoft' | 'focus'>;

function accent(primary: string, strong: string, soft: string, darkStrong: string, darkSoft: string) {
  return {
    light: { primary, primaryStrong: strong, primaryFill: strong, primarySoft: soft, focus: primary },
    dark: { primary, primaryStrong: darkStrong, primaryFill: strong, primarySoft: darkSoft, focus: darkStrong },
  } satisfies Record<ColorScheme, Accent>;
}

export const ACCENTS: Record<AccentName, Record<ColorScheme, Accent>> = {
  purple: {
    light: {
      primary: lightColors.primary,
      primaryStrong: lightColors.primaryStrong,
      primaryFill: lightColors.primaryFill,
      primarySoft: lightColors.primarySoft,
      focus: lightColors.focus,
    },
    dark: {
      primary: darkColors.primary,
      primaryStrong: darkColors.primaryStrong,
      primaryFill: darkColors.primaryFill,
      primarySoft: darkColors.primarySoft,
      focus: darkColors.focus,
    },
  },
  ocean: accent('#1F6FD1', '#1557A8', '#E3EEFB', '#8DBBF5', '#1C3150'),
  forest: accent('#2E8B57', '#1E6B41', '#E2F3E9', '#86D3A6', '#1D3A2A'),
  terracotta: accent('#D2602E', '#A8461C', '#FBEAE1', '#F2A07A', '#43281C'),
  ruby: accent('#C2185B', '#A0124A', '#FBE4EE', '#F48FB8', '#45182C'),
  teal: accent('#0F8A8A', '#0B6B6B', '#DDF3F2', '#7FD4D2', '#163B3B'),
  graphite: accent('#4A5263', '#2F3542', '#E8EAEE', '#C3C9D6', '#2B2F3A'),
};

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === 'string' && value in ACCENTS;
}

let currentScheme: ColorScheme = 'light';
let currentAccent: AccentName = 'purple';
let schemeVersion = 0;

export function currentColorScheme(): ColorScheme {
  return currentScheme;
}

/**
 * Switches every colour token to `scheme`, wearing `accent` (by default
 * whatever accent is on). Cheap when nothing changes.
 */
export function applyColorScheme(scheme: ColorScheme, accentName: AccentName = currentAccent) {
  if (scheme === currentScheme && accentName === currentAccent) return;
  currentScheme = scheme;
  currentAccent = accentName;
  schemeVersion += 1;
  Object.assign(colors, palettes[scheme], ACCENTS[accentName][scheme]);
  cardSurface.backgroundColor = colors.surface;
  cardSurface.borderColor = colors.cardBorder;
  // On a dark page a warm shadow can't be seen; black still lifts a
  // little.
  floatingShadow.shadowColor = scheme === 'dark' ? '#000000' : '#2A1F5A';
  floatingShadow.shadowOpacity = scheme === 'dark' ? 0.5 : 0.16;
}

/**
 * `StyleSheet.create` for styles that use colour tokens. The styles are
 * built on first use and again after each change of scheme, so a screen
 * re-rendering after the switch picks up the new colours.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  make: () => T & StyleSheet.NamedStyles<any>,
): T {
  let built: T | null = null;
  let builtFor = -1;
  const current = () => {
    if (builtFor !== schemeVersion || !built) {
      built = StyleSheet.create(make());
      builtFor = schemeVersion;
    }
    return built;
  };
  return new Proxy({} as T, {
    get: (_target, key) => (current() as Record<string | symbol, unknown>)[key],
  });
}

// Deliberately large size scale. React Native scales these values
// according to the device's system font size setting by default
// (Text.allowFontScaling is never disabled in our components).
export const fontSizes = {
  body: 20,
  bodyLarge: 24,
  title: 30,
  button: 22,
  caption: 17,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Minimum recommended touch target for an audience not comfortable with
// precise tapping (well above the usual 44-48px recommendation).
export const minTouchTarget = 64;

export const radii = {
  md: 12,
  lg: 16,
  // The floating menus and the profile circle: round enough to read as
  // lozenges rather than as boxes with the corners taken off.
  pill: 26,
} as const;

export const theme = { colors, fontSizes, spacing, minTouchTarget, radii };

export type Theme = typeof theme;
