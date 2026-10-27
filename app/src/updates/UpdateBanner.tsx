import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import * as Updates from 'expo-updates';
import { useI18n } from '../i18n/I18nContext';
import { cardSurface, colors, floatingShadow, radii, spacing, themedStyles } from '../theme/theme';
import { APK_URL, fetchNewUpdate, newApkAvailable, restartIntoUpdate, updatesActive } from './appUpdates';

// Phones stay open in the background for days: look again when the app
// comes back to the front, but not more often than this.
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * A floating card at the top of the screen when the app is out of date:
 * "Restart" once a new version has downloaded, "Download" when only a new
 * APK can bring it. "Later" hides it until the next launch.
 */
export function UpdateBanner() {
  // The web version and development builds have nothing to update.
  return updatesActive() ? <Banner /> : null;
}

function Banner() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Also true when the check expo-updates makes by itself at launch found
  // something, not only after the checks below.
  const { isUpdatePending } = Updates.useUpdates();
  const [newApk, setNewApk] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    async function check() {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      if (await newApkAvailable().catch(() => false)) {
        setNewApk(true);
        return;
      }
      await fetchNewUpdate().catch(() => false);
    }

    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => subscription.remove();
  }, []);

  // A new APK wins: an update for this build would be outdated anyway.
  const offer = newApk ? 'download' : isUpdatePending ? 'restart' : null;
  if (!offer || dismissed) return null;

  return (
    <View style={[styles.card, { top: insets.top + spacing.sm }]} accessibilityLiveRegion="polite">
      <AccessibleText variant="body" style={styles.text}>
        {offer === 'restart' ? t('appUpdate.ready') : t('appUpdate.newApk')}
      </AccessibleText>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('appUpdate.later')}
          hitSlop={spacing.sm}
          onPress={() => setDismissed(true)}
          style={styles.later}
        >
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('appUpdate.later')}
          </AccessibleText>
        </Pressable>
        <AccessibleButton
          label={offer === 'restart' ? t('appUpdate.restart') : t('appUpdate.download')}
          onPress={() => {
            if (offer === 'restart') {
              void restartIntoUpdate();
            } else {
              void Linking.openURL(APK_URL);
              setDismissed(true);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    ...cardSurface,
    ...floatingShadow,
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  later: {
    paddingHorizontal: spacing.sm,
  },
}));
