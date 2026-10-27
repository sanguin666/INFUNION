import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleButton } from './AccessibleButton';
import { AccessibleText } from './AccessibleText';
import { useI18n } from '../i18n/I18nContext';
import { colors, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  poiName: string | null;
  onAgree: () => Promise<void>;
  onDecline: () => void;
};

/**
 * The one question a church asks before someone joins it: belonging to a
 * church records religious belief, which the GDPR only allows with that
 * person's explicit agreement. Saying no still lets them read the place;
 * it only stops it from being one of their places.
 */
export function ReligiousConsentSheet({ poiName, onAgree, onDecline }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function agree() {
    setBusy(true);
    setFailed(false);
    try {
      await onAgree();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={poiName !== null} transparent animationType="fade" onRequestClose={onDecline}>
      <Pressable style={styles.scrim} accessibilityLabel={t('privacy.churchDecline')} onPress={() => !busy && onDecline()} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <AccessibleText variant="title">{t('privacy.churchTitle', { poiName: poiName ?? '' })}</AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('privacy.churchBody')}
        </AccessibleText>
        {failed && (
          <AccessibleText variant="body" color={colors.danger}>
            {t('privacy.termsError')}
          </AccessibleText>
        )}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.primaryStrong} size="large" />
          </View>
        ) : (
          <>
            <AccessibleButton label={t('privacy.churchAgree')} onPress={() => void agree()} />
            <AccessibleButton label={t('privacy.churchDecline')} variant="secondary" onPress={onDecline} />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  busy: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
