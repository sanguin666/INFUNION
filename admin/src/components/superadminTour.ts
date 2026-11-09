const SUPERADMIN_TOUR_KEY = 'infunion.superadminTour';

/** The superadmin visiting a community sees the tour and tips only after asking
 *  in Settings › "Tour and tips", until the browser tab closes (Seb, 9 Nov 2026). */
export function superadminAskedForTour(): boolean {
  try {
    return sessionStorage.getItem(SUPERADMIN_TOUR_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function askForSuperadminTour(): void {
  try {
    sessionStorage.setItem(SUPERADMIN_TOUR_KEY, 'yes');
  } catch {
    // No session storage: the tour stays for the community's own team.
  }
}
