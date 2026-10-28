import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Poi } from '../api/types';

const STORAGE_KEY = 'ansae.saved-places.v1';

/**
 * A place the user has opened at least once, kept on the device so the
 * banner's switcher can list it again without a login. Only the fields the
 * switcher renders are stored; the full POI is re-fetched on open so a
 * renamed place shows its new name.
 */
export type SavedPlace = {
  id: string;
  name: string;
  city: string | null;
  qrCodeToken: string;
  // What the switcher draws beside the name: the place's logo, or its
  // initials in its own colour.
  logoUrl?: string | null;
  theme?: string;
};

export function toSaved(poi: Poi): SavedPlace {
  return {
    id: poi.id,
    name: poi.name,
    city: poi.city,
    qrCodeToken: poi.qrCodeToken,
    logoUrl: poi.logoUrl ?? null,
    theme: poi.theme,
  };
}

function parse(raw: string | null): SavedPlace[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Written by an older build, or hand-edited: drop anything that isn't
    // a usable entry rather than rendering a blank row.
    return parsed.filter(
      (p): p is SavedPlace =>
        typeof p === 'object' && p !== null && typeof (p as SavedPlace).id === 'string' && typeof (p as SavedPlace).name === 'string',
    );
  } catch {
    return [];
  }
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  try {
    return parse(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/**
 * Records a place as visited and returns the updated list, most recently
 * opened first — so the switcher opens on what the user is likely to want.
 */
export async function rememberPlace(poi: Poi): Promise<SavedPlace[]> {
  const existing = await getSavedPlaces();
  const next = [toSaved(poi), ...existing.filter((p) => p.id !== poi.id)];
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage being unavailable shouldn't stop the user entering the
    // place; they just won't see it listed next time.
  }
  return next;
}

/**
 * Drops a place from this device's list and returns what is left. Called
 * when somebody leaves a place: the membership going away on the server
 * would otherwise leave the place still listed here, since the switcher
 * shows both.
 */
export async function forgetPlace(poiId: string): Promise<SavedPlace[]> {
  const next = (await getSavedPlaces()).filter((p) => p.id !== poiId);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Same as above: not being able to write is not worth failing over.
  }
  return next;
}
