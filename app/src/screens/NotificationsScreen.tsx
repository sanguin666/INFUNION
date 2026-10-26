import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Switch, View } from 'react-native';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { FormCard, FormDivider } from '../components/FormCard';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationKind,
  type NotificationPreferences,
} from '../api/notifications';
import { enablePush, getPermissionState, openPhoneSettings, type PermissionState } from '../notifications/push';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthContext';
import type { Poi } from '../api/types';
import { colors, minTouchTarget, spacing, themedStyles } from '../theme/theme';

const KINDS: { kind: NotificationKind; label: 'news' | 'requests' | 'events' | 'live' | 'readings' | 'messages'; hint: 'newsHint' | 'requestsHint' | 'eventsHint' | 'liveHint' | 'readingsHint' | 'messagesHint' }[] = [
  { kind: 'news', label: 'news', hint: 'newsHint' },
  { kind: 'requests', label: 'requests', hint: 'requestsHint' },
  { kind: 'messages', label: 'messages', hint: 'messagesHint' },
  { kind: 'events', label: 'events', hint: 'eventsHint' },
  { kind: 'live', label: 'live', hint: 'liveHint' },
  { kind: 'readings', label: 'readings', hint: 'readingsHint' },
];

/**
 * What this place may notify about, one switch per kind, all on until
 * turned off. When the phone itself blocks infunion's notifications the
 * switches would be a lie, so the screen says so instead and offers the
 * one way back.
 */
export function NotificationsScreen({ poi }: { poi: Poi }) {
  const { t, language } = useI18n();
  const { me } = useAuth();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    getNotificationPreferences(poi.id)
      .then((result) => {
        if (!cancelled) setPreferences(result);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [poi.id, me?.id]);

  // Coming back from the phone's settings is the usual way permission
  // changes, so look again whenever the app returns to the foreground.
  useEffect(() => {
    void getPermissionState().then(setPermission);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermissionState().then(setPermission);
    });
    return () => subscription.remove();
  }, []);

  async function toggle(kind: NotificationKind, value: boolean) {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, [kind]: value });
    setSaveFailed(false);
    try {
      setPreferences(await updateNotificationPreferences(poi.id, { [kind]: value }));
    } catch {
      setPreferences(previous);
      setSaveFailed(true);
    }
  }

  async function turnOn() {
    if (permission === 'denied') {
      openPhoneSettings();
      return;
    }
    setPermission(await enablePush(language));
  }

  const phoneBlocks = permission === 'denied' || permission === 'undetermined';

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('notifications.title')}</AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('notifications.from', { poiName: poi.name })}
        </AccessibleText>
      </View>

      {!me ? (
        <AccessibleText variant="body">{t('notifications.signInFirst')}</AccessibleText>
      ) : phoneBlocks ? (
        <>
          <AccessibleText variant="body">{t('notifications.phoneOff')}</AccessibleText>
          <AccessibleButton
            label={permission === 'denied' ? t('notifications.openSettings') : t('notifications.turnOn')}
            onPress={() => void turnOn()}
          />
        </>
      ) : loadFailed ? (
        <AccessibleText variant="body">{t('notifications.loadError')}</AccessibleText>
      ) : !preferences || permission === null ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <FormCard>
          {KINDS.map(({ kind, label, hint }, index) => (
            <View key={kind}>
              {index > 0 && <FormDivider />}
              {/* The whole row flips the switch: a 51pt switch is a small
                  target on its own for the people this app is for. */}
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: preferences[kind] }}
                accessibilityLabel={`${t(`notifications.${label}`)}. ${t(`notifications.${hint}`)}`}
                onPress={() => void toggle(kind, !preferences[kind])}
                style={styles.option}
              >
                <View style={styles.optionText}>
                  <AccessibleText variant="bodyLarge" style={styles.optionLabel}>
                    {t(`notifications.${label}`)}
                  </AccessibleText>
                  <AccessibleText variant="caption" color={colors.textMuted}>
                    {t(`notifications.${hint}`)}
                  </AccessibleText>
                </View>
                <Switch
                  value={preferences[kind]}
                  onValueChange={(value) => void toggle(kind, value)}
                  trackColor={{ false: colors.switchOff, true: colors.primary }}
                  thumbColor="#FFFFFF"
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                />
              </Pressable>
            </View>
          ))}
        </FormCard>
      )}

      {saveFailed && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('notifications.saveError')}
        </AccessibleText>
      )}
    </>
  );
}

const styles = themedStyles(() => ({
  titleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 14,
    paddingVertical: spacing.sm,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontWeight: '700',
  },
}));
