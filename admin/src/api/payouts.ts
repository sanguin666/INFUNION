import { apiGet, apiPost, apiPut } from "./client";

/** Where a community stands with its own payment account (Stripe Connect). */
export type PayoutsState =
  | "not_linked"
  | "incomplete"
  | "pending"
  | "payouts_paused"
  | "ready";

export type PayoutsAccount = {
  state: PayoutsState;
  ready: boolean;
  // No Stripe on the server: setting up links a demo account (no money).
  demo: boolean;
  requirements: string[];
  feePercent: number;
  // The community's own Bizum number, as people read it, or null.
  bizumPhone: string | null;
};

export function getPayoutsAccount(poiId: string): Promise<PayoutsAccount> {
  return apiGet<PayoutsAccount>(`/pois/${poiId}/payouts-account`);
}

/** Stripe's sign-up page to open, or null when the demo account was linked. */
export function startPayoutsOnboarding(
  poiId: string,
): Promise<{ url: string | null; status: PayoutsAccount }> {
  return apiPost<{ url: string | null; status: PayoutsAccount }>(
    `/pois/${poiId}/payouts-account/onboarding`,
  );
}

/** Sets the community's Bizum number; empty turns Bizum off. */
export function setBizumPhone(poiId: string, phone: string): Promise<PayoutsAccount> {
  return apiPut<PayoutsAccount>(`/pois/${poiId}/payouts-account/bizum`, { phone });
}
