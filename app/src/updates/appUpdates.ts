import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { needsNewApk } from './apkVersion';

/**
 * Two ways a phone falls behind, and what the app does about each:
 *
 * - New screens or logic: expo-updates downloads them from our backend
 *   (see backend/src/app-updates) when the app opens or comes back to the
 *   front, and they apply on the next launch, or straight away from the
 *   "Restart" banner.
 * - A new native build (a new package, a permission, the icon): no update
 *   can carry that, so the APK built by the "Demo APK" workflow says which
 *   native build it is in version.json, and a phone on another one is told
 *   to download it.
 */
const RELEASE = 'https://github.com/sanguin666/INFUNION/releases/download/demo-apk';
export const APK_URL = `${RELEASE}/infunion.apk`;
const VERSION_URL = `${RELEASE}/version.json`;

/** Only a real build talks to the update server: not Expo Go, not the web. */
export function updatesActive(): boolean {
  return Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
}

/**
 * Downloads a newer update for this build, if there is one. True when it is
 * on the phone and waiting for a restart.
 */
export async function fetchNewUpdate(): Promise<boolean> {
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return false;
  const result = await Updates.fetchUpdateAsync();
  return result.isNew;
}

export function restartIntoUpdate(): Promise<void> {
  return Updates.reloadAsync();
}

export async function newApkAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const response = await fetch(`${VERSION_URL}?t=${Date.now()}`);
  if (!response.ok) return false;
  const { runtimeVersion } = (await response.json()) as { runtimeVersion?: string };
  return needsNewApk(Updates.runtimeVersion, runtimeVersion);
}
