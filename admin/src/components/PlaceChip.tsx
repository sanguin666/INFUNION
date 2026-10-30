import { API_BASE_URL } from '../api/client';
import { placeTheme } from '../placeThemes';
import type { Poi } from '../api/types';

function initials(name: string): string {
  // "Nuestra Señora del Carmen" → NC: the capitalised words, first and last.
  const words = name.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w));
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? name];
  return picked.map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * A place's own mark in the switcher: its logo, or its initials on its
 * theme colour, so an admin of three churches always sees which one they
 * are in.
 */
export function PlaceChip({ poi, size = 32 }: { poi: Pick<Poi, 'name' | 'logoUrl' | 'theme'>; size?: number }) {
  if (poi.logoUrl) {
    return <img className="place-chip" style={{ width: size, height: size }} src={`${API_BASE_URL}${poi.logoUrl}`} alt="" />;
  }
  return (
    <span
      className="place-chip place-chip-letters"
      style={{ width: size, height: size, background: placeTheme(poi.theme).strong, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initials(poi.name)}
    </span>
  );
}
