import { Pressable, View } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationsHandle } from '../translation/useTranslations';
import { colors, spacing, themedStyles } from '../theme/theme';

const NAMED = ['en', 'es', 'ca', 'gl', 'pt', 'fr'] as const;

/** "Catalan", in the reader's words. */
export function useLanguageName() {
  const { t, language } = useI18n();
  return (code: string | null): string => {
    if (code && (NAMED as readonly string[]).includes(code)) return t(`translation.lang_${code as (typeof NAMED)[number]}`);
    try {
      const Names = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (c: string) => string } }).DisplayNames;
      if (code && Names) {
        const name = new Names([language === 'va' ? 'ca' : language], { type: 'language' }).of(code);
        if (name && name !== code) return name;
      }
    } catch {
      // Unknown to this phone: the generic words below.
    }
    return t('translation.otherLanguage');
  };
}

/**
 * Under a text in another language: "Translate", then "Translated from
 * Catalan · See original" (Seb's mockup, 4 Nov 2026). Nothing for a text
 * already in the reader's language.
 */
export function TranslateLine({ handle, id }: { handle: TranslationsHandle; id: string }) {
  const { t } = useI18n();
  const nameOf = useLanguageName();
  if (!handle.foreign(id)) return null;

  if (handle.showing(id)) {
    return (
      <View style={styles.row}>
        <AccessibleText variant="caption" color={colors.textMuted}>
          {t('translation.translatedFrom', { language: nameOf(handle.sourceLanguage(id)) })} ·{' '}
        </AccessibleText>
        <Pressable accessibilityRole="button" hitSlop={spacing.sm} onPress={() => handle.showOriginal(id)}>
          <AccessibleText variant="caption" color={colors.primary} style={styles.link}>
            {t('translation.seeOriginal')}
          </AccessibleText>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={spacing.sm}
      disabled={handle.busy(id)}
      onPress={() => handle.translate(id)}
      style={styles.row}
    >
      <AccessibleText variant="caption" color={colors.primary} style={styles.link}>
        {handle.busy(id) ? t('translation.translating') : t('translation.translate')}
      </AccessibleText>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  link: {
    fontWeight: '700',
  },
}));
