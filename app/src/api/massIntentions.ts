import { apiGet, apiPost } from './client';
import type { CheckoutResult } from './donations';

export type MassIntentionStatus = 'pending_payment' | 'confirmed' | 'celebrated' | 'cancelled';

export type MassIntention = {
  id: string;
  intention: string;
  requesterName: string;
  requesterContact: string | null;
  // Null for "whenever the community can".
  celebrationAt: string | null;
  celebrationTitle: string | null;
  offeringAmount: number | null;
  status: MassIntentionStatus;
  fromOffice: boolean;
  createdAt: string;
};

export type MassIntentionSettings = {
  // The offering the community asks for; null lets the person choose.
  offeringAmount: number | null;
  // false: the community's payment account isn't set up, so no offering
  // can be paid in the app (missing on servers from before 9 Nov 2026).
  paymentsReady?: boolean;
};

export type NewMassIntention = {
  intention: string;
  requesterName: string;
  requesterContact?: string | null;
  celebrationAt?: string | null;
  // One of the place's Masses (an event with category 'mass').
  eventId?: string | null;
  offeringAmount?: number;
};

const base = (poiId: string) => `/pois/${encodeURIComponent(poiId)}/mass-intentions`;

export function getMassIntentionSettings(poiId: string): Promise<MassIntentionSettings> {
  return apiGet<MassIntentionSettings>(`${base(poiId)}/settings`);
}

/**
 * Asks for an intention. With an offering to pay, `checkout` is the same
 * Stripe (or demo) answer a gift gets, and the intention waits on it.
 */
export function createMassIntention(
  poiId: string,
  body: NewMassIntention,
): Promise<{ intention: MassIntention; checkout: CheckoutResult | null }> {
  return apiPost(base(poiId), body);
}

export function getMassIntentionStatus(poiId: string, id: string): Promise<{ status: MassIntentionStatus }> {
  return apiGet(`${base(poiId)}/${encodeURIComponent(id)}/status`);
}

export function getMyMassIntentions(poiId: string): Promise<MassIntention[]> {
  return apiGet<MassIntention[]>(`${base(poiId)}/mine`);
}
