import { apiDelete, apiPatch, apiPostForm } from './client';
import type { ModuleType, Poi, PoiThemeName, SupportedLanguage, TaxScheme } from './types';

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

// The place's look in the app: its accent theme, and its logo on its own.
export function updatePoiBranding(poiId: string, theme: PoiThemeName): Promise<Poi> {
  return apiPatch<Poi>(`/pois/${poiId}/branding`, { theme });
}

export function uploadPoiLogo(poiId: string, file: File): Promise<Poi> {
  const formData = new FormData();
  formData.append('logo', file);
  return apiPostForm<Poi>(`/pois/${poiId}/logo`, formData);
}

export function removePoiLogo(poiId: string): Promise<Poi> {
  return apiDelete<Poi>(`/pois/${poiId}/logo`);
}
