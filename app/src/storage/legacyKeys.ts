import AsyncStorage from '@react-native-async-storage/async-storage';

// The app's previous name prefixed every key it keeps on the device. A read
// that finds nothing under the current key looks under the old one and moves
// the value across, so nobody is signed out or loses their places by the
// rename (November 2026). Remove after a while.
const LEGACY_PREFIX = 'ansae';
const PREFIX = 'infunion';

export async function getStoredItem(key: string): Promise<string | null> {
  const value = await AsyncStorage.getItem(key);
  if (value !== null || !key.startsWith(PREFIX)) return value;
  const legacyKey = LEGACY_PREFIX + key.slice(PREFIX.length);
  const legacy = await AsyncStorage.getItem(legacyKey);
  if (legacy === null) return null;
  await AsyncStorage.setItem(key, legacy);
  await AsyncStorage.removeItem(legacyKey);
  return legacy;
}
