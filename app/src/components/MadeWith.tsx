import { View } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { LogoMark } from './Logo';
import { colors, spacing, themedStyles } from '../theme/theme';
import { useI18n } from '../i18n/I18nContext';

/**
 * "Made with ⚭ infunion": where infunion's mark goes inside a place now
 * that the header carries the place's own (Seb, 28 Oct 2026). Small and
 * quiet, at the foot of More and of the place switcher.
 */
export function MadeWith() {
  const { t } = useI18n();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${t('more.madeWith')} infunion`}>
      <AccessibleText variant="caption" color={colors.textMuted}>
        {t('more.madeWith')}
      </AccessibleText>
      <LogoMark size={16} />
      <AccessibleText variant="caption" color={colors.textMuted} style={styles.name}>
        infunion
      </AccessibleText>
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  name: {
    fontWeight: '700',
  },
}));
