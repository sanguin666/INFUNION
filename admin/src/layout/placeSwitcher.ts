import { apiGet } from '../api/client';

const LAST_PLACE_KEY = 'ansae-admin-last-poi';

/** The place an admin of several places used last, to open it again. */
export function lastPlace(): string | null {
  try {
    return localStorage.getItem(LAST_PLACE_KEY);
  } catch {
    return null;
  }
}

export function rememberPlace(poiId: string): void {
  try {
    localStorage.setItem(LAST_PLACE_KEY, poiId);
  } catch {
    // Private window: it opens the first place next time, as before.
  }
}

/** What members wait on in each place the admin runs (requests, messages). */
export function getWaitingByPlace(): Promise<{ poiId: string; waiting: number }[]> {
  return apiGet('/me/admin-places/waiting');
}
