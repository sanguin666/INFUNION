import { apiGet } from './client';
import type { ActiveModule } from './types';

// ?all=1: Contributions too while its payment account isn't set up (the
// app doesn't show it then; the admin shows it greyed out).
export function getActiveModules(poiId: string): Promise<ActiveModule[]> {
  return apiGet<ActiveModule[]>(`/pois/${poiId}/active-modules?all=1`);
}

