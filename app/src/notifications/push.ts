import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { registerPushToken, removePushToken } from '../api/notifications';

/**
 * Push notifications on this phone: asking permission, handing the
 * phone's Expo push token to the backend, and forgetting it on sign out.
 *
 * Only real phones take part. The web build (the admin's live preview,
 * the browser version) has no push, and every function here quietly does
 * nothing there.
 */

export type PushTarget = {
  poiId: string;
  screen: 'announcement' | 'request' | 'event' | 'livestream' | 'readings' | 'messages';
  id: string;
};

export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'unsupported';

const supported = Platform.OS !== 'web';

// A notification arriving while the app is open still shows as a banner:
// otherwise someone looking at the home page would never see it.
if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// The token this phone registered, remembered so signing out can hand it
// back to the backend.
let registeredToken: string | null = null;

export async function getPermissionState(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Asks the phone for permission if it hasn't been refused for good, then
 * registers. Returns whether notifications can now arrive. When Android
 * no longer asks, the only way back is the phone's own settings; the
 * Notifications screen offers that.
 */
export async function enablePush(language: string): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  if (Platform.OS === 'android') {
    // Android 8+ needs a channel before it shows anything, and 13+ only
    // shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'INFUNION',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let state = await getPermissionState();
  if (state === 'undetermined') {
    const { status } = await Notifications.requestPermissionsAsync();
    state = status === 'granted' ? 'granted' : await getPermissionState();
  }
  if (state === 'granted') await registerThisPhone(language);
  return state;
}

/** Registers again without asking: every launch, and on a language change. */
export async function refreshPush(language: string): Promise<void> {
  if ((await getPermissionState()) === 'granted') await registerThisPhone(language);
}

export async function disablePushForSignOut(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (token) await removePushToken(token).catch(() => undefined);
}

export function openPhoneSettings(): void {
  void Linking.openSettings();
}

async function registerThisPhone(language: string): Promise<void> {
  try {
    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await registerPushToken(token, language, Intl.DateTimeFormat().resolvedOptions().timeZone);
    registeredToken = token;
  } catch (error) {
    // No Firebase setup in this build, no network, Expo Go: the app works
    // the same, just without notifications.
    console.warn('Push registration failed', error);
  }
}

/** What a tapped notification asks to open, if it is one of ours. */
export function targetOf(response: Notifications.NotificationResponse | null): PushTarget | null {
  const data = response?.notification.request.content.data as Partial<PushTarget> | undefined;
  if (!data?.poiId || !data.screen || !data.id) return null;
  return { poiId: data.poiId, screen: data.screen, id: data.id };
}

/**
 * Calls back with each notification tapped, including the one that
 * launched the app from closed. Returns the unsubscribe.
 */
export function onNotificationTapped(callback: (target: PushTarget) => void): () => void {
  if (!supported) return () => undefined;
  let handled: string | null = null;
  const handle = (response: Notifications.NotificationResponse | null) => {
    const target = targetOf(response);
    const key = response?.notification.request.identifier ?? null;
    // The launching tap can arrive through both routes below.
    if (!target || key === handled) return;
    handled = key;
    callback(target);
  };
  void Notifications.getLastNotificationResponseAsync().then(handle);
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
