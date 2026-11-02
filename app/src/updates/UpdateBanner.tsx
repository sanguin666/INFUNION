import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, View } from 'react-native';
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
 * A card in the middle of the screen, over a dimmed background, when the
 * app is out of date (Seb, 2 Nov 2026: centred, not at the top):
 * "Restart" once a new version has downloaded, "Download" when only a new
 * APK can bring it. "Later" hides it until the next launch.
 *
 * It is a transparent `Modal`, like the app's other sheets. It used to be
 * a full-screen view with `elevation: 100`, and Android drew that
 * elevation's shadow through the see-through dimming, which showed as a
 * lighter vertical band down the middle of the screen (Seb, 2 Nov 2026).
 * `hidden` holds it back while the opening animation plays, since a
 * Modal sits above everything else.
 */
export function UpdateBanner({ hidden = false }: { hidden?: boolean }) {
  // The web version and development builds have nothing to update.
  return updatesActive() ? <Banner hidden={hidden} /> : null;
}

function Banner({ hidden }: { hidden: boolean }) {
  const { t } = useI18n();
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
    <Modal
      visible={!hidden}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setDismissed(true)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal accessibilityLiveRegion="polite">
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
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 26, 45, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    ...cardSurface,
    ...floatingShadow,
    width: '100%',
    maxWidth: 420,
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
