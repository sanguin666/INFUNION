import { View } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { AccessibleButton } from './AccessibleButton';
import { GlobeIcon } from './icons';
import { useLanguageName } from './TranslateLine';
import { useI18n } from '../i18n/I18nContext';
import { colors, floatingShadow, radii, spacing, themedStyles } from '../theme/theme';

/**
 * The one-time question (Seb, 6 Nov 2026): the first time a member meets
 * a text in another language, a card above the bottom menu offers to
 * translate everything automatically. Either answer is kept, and More ›
 * Language changes it later.
 */
export function AutoTranslateOffer() {
  const { t, translateOffer, setAutoTranslate } = useI18n();
  const nameOf = useLanguageName();
  if (!translateOffer) return null;
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.titleRow}>
        <GlobeIcon size={22} color={colors.primary} />
        <AccessibleText variant="body" style={styles.title}>
          {t('translation.offerTitle')}
        </AccessibleText>
      </View>
      <AccessibleText variant="caption" color={colors.textMuted}>
        {t('translation.offerBody', { language: nameOf(translateOffer) })}
      </AccessibleText>
      <View style={styles.actions}>
        <AccessibleButton label={t('translation.offerNo')} variant="secondary" onPress={() => setAutoTranslate(false)} style={styles.action} />
        <AccessibleButton label={t('translation.offerYes')} onPress={() => setAutoTranslate(true)} style={styles.action} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...floatingShadow,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  action: {
    flex: 1,
  },
}));
