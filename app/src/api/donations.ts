import { apiGet, apiPost } from './client';

export type DonationsConfig = {
  paymentsEnabled: boolean;
  currency: string;
};

export type CheckoutResult =
  | { mode: 'demo'; donationId: string }
  | { mode: 'stripe'; donationId: string; checkoutUrl: string };

export type DonationStatus = {
  status: 'pending' | 'completed' | 'failed';
  amount: number;
};

export function getDonationsConfig(): Promise<DonationsConfig> {
  return apiGet<DonationsConfig>('/donations/config');
}

export type DonationPurpose = 'general' | 'collection' | 'campaign';

// A project the community is raising money for (a new roof, the organ).
export type Campaign = {
  id: string;
  title: string;
  description: string | null;
  goalAmount: number | null;
  endsAt: string | null;
  active: boolean;
  raised: number;
  giftCount: number;
  // A picture of what the money is for: prefix it with API_BASE_URL.
  imageUrl: string | null;
};

// Where a gift can go from the Donations tab besides the general fund:
// one of the projects.
export type DonationProject = { kind: 'campaign'; campaign: Campaign };

// One of the giver's own gifts. `receiptUrl` is a signed link to its
// printable tax receipt, or null when none was asked for.
export type MyGift = {
  id: string;
  amount: number;
  createdAt: string;
  purpose: DonationPurpose | 'mass_intention';
  campaignTitle: string | null;
  recurring: boolean;
  wantsReceipt: boolean;
  receiptUrl: string | null;
};

export type ReceiptDetails = {
  donorName: string;
  donorAddress: string;
  donorPostalCode: string;
  donorCity: string;
  donorTaxId?: string | null;
};

export type CheckoutBody = {
  amount: number;
  donorName?: string;
  purpose?: DonationPurpose;
  campaignId?: string;
  // Monthly; needs the giver to be signed in.
  recurring?: boolean;
  wantsReceipt?: boolean;
  donorAddress?: string;
  donorPostalCode?: string;
  donorCity?: string;
  donorTaxId?: string | null;
};

export type MonthlyGift = {
  id: string;
  amount: number;
  purpose: DonationPurpose;
  campaign: { id: string; title: string } | null;
  createdAt: string;
};

/**
 * Starts a gift. Comes back with a Stripe checkout page to open, or
 * `mode: 'demo'` when the backend has no Stripe key — see the backend's
 * donations/stripe.service.ts.
 */
export function startDonationCheckout(
  poiId: string,
  body: CheckoutBody,
): Promise<CheckoutResult> {
  return apiPost<CheckoutResult>(`/pois/${encodeURIComponent(poiId)}/donations/checkout`, body);
}

export function getDonationStatus(poiId: string, donationId: string): Promise<DonationStatus> {
  return apiGet<DonationStatus>(
    `/pois/${encodeURIComponent(poiId)}/donations/${encodeURIComponent(donationId)}/status`,
  );
}

export function getCampaigns(poiId: string): Promise<Campaign[]> {
  return apiGet<Campaign[]>(`/pois/${encodeURIComponent(poiId)}/campaigns`);
}

export function getMyMonthlyGifts(poiId: string): Promise<MonthlyGift[]> {
  return apiGet<MonthlyGift[]>(`/pois/${encodeURIComponent(poiId)}/donations/mine/monthly`);
}

export function stopMonthlyGift(poiId: string, donationId: string): Promise<void> {
  return apiPost<void>(
    `/pois/${encodeURIComponent(poiId)}/donations/mine/monthly/${encodeURIComponent(donationId)}/stop`,
  );
}

export function getMyGifts(poiId: string): Promise<MyGift[]> {
  return apiGet<MyGift[]>(`/pois/${encodeURIComponent(poiId)}/donations/mine/gifts`);
}

export function requestGiftReceipt(poiId: string, donationId: string, details: ReceiptDetails): Promise<MyGift> {
  return apiPost<MyGift>(
    `/pois/${encodeURIComponent(poiId)}/donations/mine/gifts/${encodeURIComponent(donationId)}/receipt`,
    details,
  );
}
