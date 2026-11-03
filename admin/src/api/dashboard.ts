import { apiGet } from './client';
import type { DashboardSummary } from './types';

// What is waiting on the office, and the week's numbers; see
// backend/src/dashboard/dashboard.service.ts.
export function getDashboard(poiId: string): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>(`/pois/${poiId}/dashboard`);
}

/** The counts beside the admin menu's rows: what waits on the team. */
export type MenuCounts = { requests: number; massIntentions: number; messages: number };

export function getMenuCounts(poiId: string): Promise<MenuCounts> {
  return apiGet<MenuCounts>(`/pois/${poiId}/dashboard/menu-counts`);
}
