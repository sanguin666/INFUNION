import { ApiError, apiDelete, apiGet, apiPatch, apiPost, setSuperadminSession, type SuperadminSession } from './client';
import type { BillingSummary, ModuleType, PlanTier, PoiType, SupportedLanguage } from './types';

// ---- the code step

export type SuperadminStatus = { email: string; enrolled: boolean };

export function getSuperadminStatus(): Promise<SuperadminStatus> {
  return apiGet<SuperadminStatus>('/superadmin/auth/status');
}

export function startEnrollment(password: string): Promise<{ secret: string; otpauthUrl: string }> {
  return apiPost('/superadmin/auth/enroll', { password });
}

export function confirmEnrollment(code: string): Promise<SuperadminSession> {
  return apiPost<SuperadminSession>('/superadmin/auth/enroll/confirm', { code });
}

export function verifyCode(code: string): Promise<SuperadminSession> {
  return apiPost<SuperadminSession>('/superadmin/auth/verify', { code });
}

export const SUPERADMIN_EXPIRED_EVENT = 'infunion-superadmin-expired';

/**
 * Every superadmin call: a 401 means the hour is up (or the session was
 * never there), so the tab forgets it and the gate asks for a code again.
 */
async function guarded<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setSuperadminSession(null);
      window.dispatchEvent(new Event(SUPERADMIN_EXPIRED_EVENT));
    }
    throw error;
  }
}

// ---- overview

/** One line of "To watch": a kind plus its figures, worded by the admin in its own language. */
export type WatchItem = {
  level: 'warn' | 'alert' | 'ok';
  kind: 'trialEnding' | 'requestsWaiting' | 'adminQuiet' | 'suspended' | 'demoLogin' | 'errors' | 'ok';
  poiId?: string;
  poiName?: string;
  module?: string;
  plan?: PlanTier;
  n?: number;
  days?: number;
  date?: string;
  never?: boolean;
};

export type Overview = {
  generatedAt: string;
  environment: string;
  revenue: {
    thisMonth: number;
    lastMonth: number;
    byMonth: { month: string; total: number }[];
    monthlyRecurring: number;
    paidPlans: number;
    trialPlans: number;
    trialPotential: number;
    offeredPlans: number;
    offeredModules: number;
    demo: boolean;
  };
  communities: { total: number; comped: number; paying: number; suspended: number; newThisMonth: number };
  members: { total: number; newThisMonth: number; active30Days: number };
  donations: { thisMonth: number; fee: number; count: number };
  requests: { open: number; waitingOverAWeek: number };
  watch: WatchItem[];
};

export const getOverview = () => guarded(() => apiGet<Overview>('/superadmin/overview'));

// ---- communities

export type CommunityBilling = 'comped' | 'offered' | 'paying' | 'trial' | 'free' | 'suspended';

export type CommunityRow = {
  id: string;
  name: string;
  city: string | null;
  postalCode: string | null;
  language: SupportedLanguage;
  createdAt: string;
  suspendedAt: string | null;
  billing: CommunityBilling;
  members: number;
  admins: number;
  lastAdminLoginAt: string | null;
  liveModules: number;
  totalModules: number;
  plan: PlanTier;
  offeredModules: number;
  nextTrialEnd: string | null;
  monthly: number;
};

export type CommunityAdmin = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  lastLoginAt: string | null;
};

export type CommunityDetail = {
  poi: {
    id: string;
    name: string;
    type: PoiType;
    language: SupportedLanguage;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    qrCodeToken: string;
    createdAt: string;
    suspendedAt: string | null;
  };
  memberCount: number;
  admins: CommunityAdmin[];
  billing: BillingSummary;
  allModules: ModuleType[];
};

export type CommunityInput = {
  name?: string;
  // The kind of place: only the superadmin sets it (Seb, 18 Oct 2026).
  type?: PoiType;
  language?: SupportedLanguage;
  address?: string;
  city?: string;
  postalCode?: string;
  billingComped?: boolean;
};

export type NewAdmin = { userId: string; email: string; temporaryPassword: string | null };

export const listCommunities = () => guarded(() => apiGet<CommunityRow[]>('/superadmin/pois'));

export const createCommunity = (body: CommunityInput & { name: string; adminEmail: string; adminFirstName?: string }) =>
  guarded(() => apiPost<{ poi: { id: string; name: string }; admin: NewAdmin }>('/superadmin/pois', body));

export const getCommunity = (poiId: string) => guarded(() => apiGet<CommunityDetail>(`/superadmin/pois/${poiId}`));

export const updateCommunity = (poiId: string, body: CommunityInput) =>
  guarded(() => apiPatch<CommunityDetail>(`/superadmin/pois/${poiId}`, body));

export const setSuspended = (poiId: string, suspended: boolean) =>
  guarded(() => apiPost<CommunityDetail>(`/superadmin/pois/${poiId}/${suspended ? 'suspend' : 'unsuspend'}`));

export const deleteCommunity = (poiId: string, confirmName: string) =>
  guarded(() => apiPost<{ deleted: true }>(`/superadmin/pois/${poiId}/delete`, { confirmName }));

export type ModuleAction = 'start' | 'stop' | 'offer' | 'unoffer';

export type PlanAction = 'offer' | 'unoffer' | 'extend-trial';

export const planAction = (poiId: string, action: PlanAction, tier?: PlanTier) =>
  guarded(() => apiPost<CommunityDetail>(`/superadmin/pois/${poiId}/plan/${action}`, { tier }));

export const moduleAction = (poiId: string, type: ModuleType, action: ModuleAction) =>
  guarded(() => apiPost<CommunityDetail>(`/superadmin/pois/${poiId}/modules/${type}/${action}`));

export const addAdmin = (poiId: string, email: string, firstName?: string) =>
  guarded(() => apiPost<{ admin: NewAdmin; community: CommunityDetail }>(`/superadmin/pois/${poiId}/admins`, { email, firstName }));

export const removeAdmin = (poiId: string, userId: string) =>
  guarded(() => apiDelete<CommunityDetail>(`/superadmin/pois/${poiId}/admins/${userId}`));

export const resetAdminPassword = (poiId: string, userId: string) =>
  guarded(() => apiPost<{ email: string; temporaryPassword: string }>(`/superadmin/pois/${poiId}/admins/${userId}/reset-password`));

// ---- accounts

export type Account = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  language: SupportedLanguage;
  createdAt: string;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  isSuperadmin: boolean;
  communities: { id: string; name: string; role: 'member' | 'admin'; joinedAt: string }[];
};

export const searchAccounts = (q: string) =>
  guarded(() => apiGet<Account[]>(`/superadmin/users?q=${encodeURIComponent(q)}`));

export const deleteAccount = (userId: string) => guarded(() => apiDelete<{ deleted: true }>(`/superadmin/users/${userId}`));

// ---- health and journal

export type Health = {
  environment: string;
  nodeEnv: string;
  version: string | null;
  branch: string | null;
  startedAt: string;
  uptimeSeconds: number;
  memoryMb: number;
  database: { ok: boolean; latencyMs: number; sizeMb: number };
  errors24h: number;
  recentErrors: { at: string; method: string; path: string; status: number; message: string }[];
  push: { enabled: boolean; devices: number };
  demoLogin: boolean;
  stripe: boolean;
  warnings: ('demoLogin' | 'initialPassword' | 'reset2fa' | 'cors')[];
};

export const getHealth = () => guarded(() => apiGet<Health>('/superadmin/health'));

export type JournalEntry = {
  id: string;
  createdAt: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  poiId: string | null;
  poiName: string | null;
  details: Record<string, unknown>;
  ip: string | null;
};

export const getJournal = (params: { before?: string; action?: string } = {}) => {
  const query = new URLSearchParams();
  if (params.before) query.set('before', params.before);
  if (params.action) query.set('action', params.action);
  const suffix = query.toString() ? `?${query}` : '';
  return guarded(() => apiGet<JournalEntry[]>(`/superadmin/audit${suffix}`));
};

export const changeSuperadminPassword = (currentPassword: string, newPassword: string) =>
  guarded(() => apiPost<{ changed: true }>('/superadmin/me/password', { currentPassword, newPassword }));
