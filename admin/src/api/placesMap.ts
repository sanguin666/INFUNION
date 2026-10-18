import { apiGet, apiPatch } from './client';
import type { Poi } from './types';

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  postalCode: string | null;
};

// Looked up on OpenStreetMap through the backend, only when asked: its
// free service allows no search-as-you-type.
export function geocode(q: string, language: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q, language });
  return apiGet<GeocodeResult[]>(`/map/geocode?${params}`);
}

export function updatePoiLocation(
  poiId: string,
  body: {
    address?: string;
    city?: string;
    postalCode?: string;
    latitude?: number | null;
    longitude?: number | null;
    mapVisible?: boolean;
  },
): Promise<Poi> {
  return apiPatch<Poi>(`/pois/${poiId}/location`, body);
}
