import { apiPatch } from './client';
import type { ModuleType, Poi, SupportedLanguage, TaxScheme } from './types';

export function updatePoiLanguage(poiId: string, language: SupportedLanguage): Promise<Poi> {
  return apiPatch<Poi>(`/pois/${poiId}/language`, { language });
}

export function updatePoiProfile(
  poiId: string,
  body: { description?: string; pictureUrl?: string; qrFlyerHeadline?: string; qrFlyerSubtext?: string },
): Promise<Poi> {
  return apiPatch<Poi>(`/pois/${poiId}/profile`, body);
}

export function updatePoiMenuOrder(poiId: string, menuOrder: ModuleType[]): Promise<Poi> {
  return apiPatch<Poi>(`/pois/${poiId}/menu-order`, { menuOrder });
}

// Who the tax receipts are issued by; an empty string clears a field.
export function updateReceiptSettings(
  poiId: string,
  body: {
    legalName?: string;
    legalTaxId?: string;
    legalAddress?: string;
    receiptSignatory?: string;
    legalPhone?: string;
    taxScheme?: TaxScheme;
  },
): Promise<Poi> {
  return apiPatch<Poi>(`/pois/${poiId}/receipt-settings`, body);
}
