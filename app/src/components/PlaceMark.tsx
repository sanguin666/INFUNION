import { Image, View } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { uploadUri } from '../api/client';
import { ACCENTS, colors, currentColorScheme, isAccentName, themedStyles } from '../theme/theme';

/**
 * A place's own mark, in a circle (Seb chose this, 28 Oct 2026): its logo
 * when its admin uploaded one, otherwise its initials on its theme colour.
 * Inside a place it stands where infunion's rings used to, in the header;
 * the place switcher shows one beside each place.
 *
 * Purely visual, like Avatar: whatever wraps it carries the label.
 */
export function PlaceMark({
  place,
  size,
}: {
  place: { name: string; logoUrl?: string | null; theme?: string };
  size: number;
}) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (place.logoUrl) {
    return (
      <Image
        source={{ uri: uploadUri(place.logoUrl) }}
        style={[circle, styles.logo]}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  }

  // The fill under white letters stays dark in both schemes.
  const fill = isAccentName(place.theme) ? ACCENTS[place.theme][currentColorScheme()].primaryFill : colors.primaryFill;
  return (
    <View
      style={[circle, styles.initials, { backgroundColor: fill }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <AccessibleText
        variant="body"
        color={colors.primaryText}
        style={[styles.initialsText, { fontSize: Math.round(size * 0.38) }]}
      >
        {placeInitials(place.name)}
      </AccessibleText>
    </View>
  );
}

// Words too small to stand for a place in its initials.
const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'i', 'of', 'the', 'and', 'du', 'des', 'le', 'les', 'da', 'do', 'dos', 'das', 'a', 'o', 'en']);

/** "Crecer Juntos" → "CJ"; "Club de Vela Pobla" → "CV". Up to two letters. */
export function placeInitials(name: string): string {
  const words = name
    .split(/[\s\-–—'’.]+/)
    .filter(Boolean);
  const meaningful = words.filter((word) => !SMALL_WORDS.has(word.toLowerCase()));
  const picked = (meaningful.length > 0 ? meaningful : words).slice(0, 2);
  return picked.map((word) => [...word][0]?.toUpperCase() ?? '').join('');
}

const styles = themedStyles(() => ({
  logo: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontWeight: '800',
  },
}));
