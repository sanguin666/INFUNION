import { apiGet } from './client';
import type { PoiType } from './types';

/** A place on the map of communities, as anybody may see it. */
export type MapPlace = {
  id: string;
  name: string;
  type: PoiType;
  description: string | null;
  pictureUrl: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  // Null only in a name search, for a place not pinned on the map yet.
  latitude: number | null;
  longitude: number | null;
  qrCodeToken: string;
  memberCount: number;
  // Kilometres from where the person is; null when the app gave no point.
  distanceKm: number | null;
};

export type Origin = { latitude: number; longitude: number; label: string | null };

// Nearest first around `origin`. The position goes into this one request
// and is stored nowhere. With `name`, only the places whose name holds it.
export function getMapPlaces(origin: Origin | null, name?: string): Promise<MapPlace[]> {
  const params = new URLSearchParams();
  if (name) params.set('q', name);
  if (origin) {
    params.set('lat', String(origin.latitude));
    params.set('lng', String(origin.longitude));
    params.set('limit', '100');
  }
  const query = params.toString();
  return apiGet<MapPlace[]>(`/map/places${query ? `?${query}` : ''}`);
}

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  city: string | null;
  postalCode: string | null;
};

export function geocode(q: string, language: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q, language });
  return apiGet<GeocodeResult[]>(`/map/geocode?${params}`);
}
