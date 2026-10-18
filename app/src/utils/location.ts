import * as Location from 'expo-location';

export type Position = { latitude: number; longitude: number };

/**
 * Where the phone is, asked once when the person taps "Use my location".
 * Town-level accuracy is plenty for "near you" and comes back faster. The
 * position is handed to one request and kept nowhere.
 */
export async function currentPosition(): Promise<Position | 'denied' | 'unavailable'> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return 'denied';
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return 'unavailable';
  }
}

/** "350 m", "1,2 km", "14 km", in the reader's own number format. */
export function formatDistance(km: number, locale: string): string {
  if (km < 1) {
    const metres = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${new Intl.NumberFormat(locale).format(metres)} m`;
  }
  const digits = km < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(km)} km`;
}
