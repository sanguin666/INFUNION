import { apiGet, apiPost, apiPut } from './client';
import type { BillingInterval, BillingSummary, ModuleType, PlanTier } from './types';

const base = (poiId: string) => `/pois/${poiId}/billing`;

export function getBilling(poiId: string): Promise<BillingSummary> {
  return apiGet<BillingSummary>(base(poiId));
}

// "Essayer 1 mois gratuit": once per community.
export function startPlanTrial(poiId: string, tier: PlanTier): Promise<BillingSummary> {
  return apiPost<BillingSummary>(`${base(poiId)}/plan/${tier}/trial`, {});
}

// Another plan: a bigger one now, a smaller one on the renewal date.
export function choosePlan(poiId: string, tier: PlanTier): Promise<BillingSummary> {
  return apiPost<BillingSummary>(`${base(poiId)}/plan/${tier}`, {});
}

// Shows a module of the plan in the app, at no cost.
export function startModule(poiId: string, type: ModuleType): Promise<BillingSummary> {
  return apiPost<BillingSummary>(`${base(poiId)}/modules/${type}/start`, {});
}

// Hides it; its content is kept.
export function stopModule(poiId: string, type: ModuleType): Promise<BillingSummary> {
  return apiPost<BillingSummary>(`${base(poiId)}/modules/${type}/stop`, {});
}

export function setBillingInterval(poiId: string, interval: BillingInterval): Promise<BillingSummary> {
  return apiPut<BillingSummary>(`${base(poiId)}/interval`, { interval });
}

export function setPaymentMethod(poiId: string, kind: 'sepa' | 'card', last4: string): Promise<BillingSummary> {
  return apiPut<BillingSummary>(`${base(poiId)}/payment-method`, { kind, last4 });
}
