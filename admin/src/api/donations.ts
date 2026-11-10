import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './client';
import type { Campaign, CampaignAllocationLine, Donation, DonationStats, Modelo182Check, ReceiptList } from './types';

export function getDonationStats(poiId: string): Promise<DonationStats> {
  return apiGet<DonationStats>(`/pois/${poiId}/donations/stats`);
}

export function getRecentDonations(poiId: string, limit = 8): Promise<Donation[]> {
  return apiGet<Donation[]>(`/pois/${poiId}/donations?limit=${limit}`);
}

// ---- Campaigns ----

export type CampaignInput = {
  title: string;
  description?: string | null;
  goalAmount?: number | null;
  endsAt?: string | null;
  active?: boolean;
  allocation?: CampaignAllocationLine[] | null;
};

// Every campaign, the hidden ones too, with what each has raised.
export function getCampaigns(poiId: string): Promise<Campaign[]> {
  return apiGet<Campaign[]>(`/pois/${poiId}/campaigns/all`);
}

export function createCampaign(poiId: string, body: CampaignInput): Promise<Campaign> {
  return apiPost<Campaign>(`/pois/${poiId}/campaigns`, body);
}

export function updateCampaign(poiId: string, id: string, body: Partial<CampaignInput>): Promise<Campaign> {
  return apiPatch<Campaign>(`/pois/${poiId}/campaigns/${id}`, body);
}

// The campaign's gifts are kept; they just stop counting towards a goal.
export function deleteCampaign(poiId: string, id: string): Promise<void> {
  return apiDelete<void>(`/pois/${poiId}/campaigns/${id}`);
}

export function uploadCampaignImage(poiId: string, id: string, file: File): Promise<Campaign> {
  const formData = new FormData();
  formData.append('image', file);
  return apiPostForm<Campaign>(`/pois/${poiId}/campaigns/${id}/image`, formData);
}

export function removeCampaignImage(poiId: string, id: string): Promise<Campaign> {
  return apiDelete<Campaign>(`/pois/${poiId}/campaigns/${id}/image`);
}

// ---- Tax receipts ----

export function getReceipts(poiId: string, year: number): Promise<ReceiptList> {
  return apiGet<ReceiptList>(`/pois/${poiId}/donations/receipts?year=${year}`);
}

// What the year's modelo 182 file would hold, and who it leaves out.
export function getModelo182Check(poiId: string, year: number): Promise<Modelo182Check> {
  return apiGet<Modelo182Check>(`/pois/${poiId}/donations/receipts/modelo182?year=${year}`);
}

// ---- Payment links (a link and QR code anyone can pay through) ----

export type PaymentLink = {
  id: string;
  code: string;
  title: string;
  campaignId: string | null;
  campaignTitle: string | null;
  // null: the payer chooses.
  amount: number | null;
  askName: boolean;
  // The last day it takes payments (YYYY-MM-DD), or null.
  endsOn: string | null;
  // The community's own "Contribute" link, always there.
  isDefault: boolean;
  paidCount: number;
  paidTotal: number;
};

export type PaymentLinkInput = {
  title: string;
  campaignId: string | null;
  amount: number | null;
  askName: boolean;
  endsOn: string | null;
};

export function getPaymentLinks(poiId: string): Promise<PaymentLink[]> {
  return apiGet<PaymentLink[]>(`/pois/${poiId}/payment-links`);
}

export function createPaymentLink(poiId: string, body: PaymentLinkInput): Promise<PaymentLink> {
  return apiPost<PaymentLink>(`/pois/${poiId}/payment-links`, body);
}

export function updatePaymentLink(poiId: string, id: string, body: Partial<PaymentLinkInput>): Promise<PaymentLink> {
  return apiPatch<PaymentLink>(`/pois/${poiId}/payment-links/${id}`, body);
}

// The link stops taking payments; what was paid through it stays.
export function deletePaymentLink(poiId: string, id: string): Promise<void> {
  return apiDelete<void>(`/pois/${poiId}/payment-links/${id}`);
}
