import { apiGet, apiPatch, apiPost } from './client';
import type { MassIntention, MassIntentionStatus } from './types';

// 'upcoming' is what is still to be said; 'all' adds the celebrated and
// cancelled ones.
export type IntentionFilter = 'upcoming' | 'all';

export function getIntentionSettings(poiId: string): Promise<{ offeringAmount: number | null; paymentsReady?: boolean }> {
  return apiGet<{ offeringAmount: number | null; paymentsReady?: boolean }>(`/pois/${poiId}/mass-intentions/settings`);
}

// null: no set offering, the person asking chooses.
export function updateIntentionSettings(
  poiId: string,
  offeringAmount: number | null,
): Promise<{ offeringAmount: number | null }> {
  return apiPatch<{ offeringAmount: number | null }>(`/pois/${poiId}/mass-intentions/settings`, { offeringAmount });
}

export function getIntentions(poiId: string, filter: IntentionFilter): Promise<MassIntention[]> {
  return apiGet<MassIntention[]>(`/pois/${poiId}/mass-intentions${filter === 'all' ? '?filter=all' : ''}`);
}

// One asked for at the office desk rather than from the app.
export function addOfficeIntention(
  poiId: string,
  body: {
    intention: string;
    requesterName: string;
    requesterContact?: string;
    celebrationAt?: string | null;
    celebrationTitle?: string | null;
    offeringAmount?: number | null;
  },
): Promise<MassIntention> {
  return apiPost<MassIntention>(`/pois/${poiId}/mass-intentions/office`, body);
}

export function updateIntention(
  poiId: string,
  id: string,
  body: { status?: MassIntentionStatus; celebrationAt?: string | null; celebrationTitle?: string | null },
): Promise<MassIntention> {
  return apiPatch<MassIntention>(`/pois/${poiId}/mass-intentions/${id}`, body);
}
