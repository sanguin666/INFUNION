import { apiDelete, apiGet, apiPost } from './client';

export type ClosureReason = 'not_used' | 'too_expensive' | 'other_tool' | 'place_closed' | 'merged' | 'other';

export const CLOSURE_REASONS: ClosureReason[] = ['not_used', 'too_expensive', 'other_tool', 'place_closed', 'merged', 'other'];

export type ClosureStatus = {
  state: 'open' | 'closing' | 'closed';
  requestedAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  requestedBy: string | null;
  graceDays: number;
  name: string;
  members: number;
  monthlyGifts: number;
  passwordRequired: boolean;
};

export const getClosure = (poiId: string) => apiGet<ClosureStatus>(`/pois/${poiId}/closure`);

export const requestClosure = (
  poiId: string,
  body: { confirmName: string; password?: string; authority: boolean; reason?: ClosureReason },
) => apiPost<ClosureStatus>(`/pois/${poiId}/closure`, body);

export const cancelClosure = (poiId: string) => apiDelete<ClosureStatus>(`/pois/${poiId}/closure`);

/** A signed link the browser opens itself to download the ZIP. */
export const getExportLink = (poiId: string) => apiPost<{ url: string }>(`/pois/${poiId}/closure/export-link`);

/** Told to the banner on every page when the closing starts or is taken back. */
export const CLOSURE_CHANGED = 'infunion:closure-changed';

export function announceClosureChange(): void {
  window.dispatchEvent(new Event(CLOSURE_CHANGED));
}
