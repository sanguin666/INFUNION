import { apiDelete, apiGet, apiPatch, apiPost } from './client';

/** Someone on the community's own list (imported or added by hand). */
export type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  language: string | null;
  groups: string[];
  status: 'notInApp' | 'invited' | 'inApp' | 'stopped';
  userId: string | null;
  invitedAt: string | null;
  linkedAt: string | null;
  lastWrittenAt: string | null;
  invitationClicked: boolean;
  createdAt: string;
};

export type ContactFields = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  language?: string | null;
  groups?: string[] | string | null;
};

export type ImportRow = ContactFields;

export type ImportEntry = { name: string; rows: number[] };
export type ImportProblem = { row: number; problem: 'unreachable' | 'badEmail' | 'badPhone'; name: string | null };

export type ImportCheck = {
  rows: number;
  added: ImportEntry[];
  updated: ImportEntry[];
  inApp: ImportEntry[];
  merged: ImportEntry[];
  problems: ImportProblem[];
};

export type ImportResult = { added: number; updated: number; inApp: number; skipped: number };

export type OutreachKind = 'invitation' | 'contribution' | 'message';
export type Audience = 'notInApp' | 'notInvited' | 'everyone' | 'group' | 'contacts';

export type OutreachInput = {
  kind: OutreachKind;
  audience: Audience;
  group?: string;
  contactIds?: string[];
  subject: string;
  body: string;
  campaignId?: string | null;
};

export type OutreachView = {
  id: string;
  kind: OutreachKind;
  subject: string;
  audience: string;
  createdAt: string;
  finishedAt: string | null;
  recipients: number;
  sent: number;
  failed: number;
  clicked: number;
  joined: number;
  contributed: number;
  contributedAmount: number;
};

export type Allowance = { plan: 'basic' | 'essentials' | 'complete'; limit: number; used: number; canWrite: boolean };

export const getContacts = (poiId: string) => apiGet<ContactRow[]>(`/pois/${poiId}/contacts`);
export const getContactGroups = (poiId: string) => apiGet<string[]>(`/pois/${poiId}/contacts/groups`);
export const checkImport = (poiId: string, rows: ImportRow[]) =>
  apiPost<ImportCheck>(`/pois/${poiId}/contacts/check`, { rows });
export const runImport = (poiId: string, rows: ImportRow[], fileName: string) =>
  apiPost<ImportResult>(`/pois/${poiId}/contacts/import`, { rows, fileName, confirmed: true });
export const addContact = (poiId: string, fields: ContactFields) => apiPost<ContactRow>(`/pois/${poiId}/contacts`, fields);
export const updateContact = (poiId: string, id: string, fields: ContactFields) =>
  apiPatch<ContactRow>(`/pois/${poiId}/contacts/${id}`, fields);
export const deleteContact = (poiId: string, id: string) => apiDelete<void>(`/pois/${poiId}/contacts/${id}`);
export const exportContact = (poiId: string, id: string) => apiGet<unknown>(`/pois/${poiId}/contacts/${id}/export`);
export const whatsappInvite = (poiId: string, id: string) =>
  apiPost<{ url: string; text: string }>(`/pois/${poiId}/contacts/${id}/whatsapp`);

export const getOutreach = (poiId: string) => apiGet<OutreachView[]>(`/pois/${poiId}/outreach`);
export const getAllowance = (poiId: string) => apiGet<Allowance>(`/pois/${poiId}/outreach/allowance`);
export const getAudience = (poiId: string, input: OutreachInput) =>
  apiPost<{ withEmail: number; withoutEmail: number }>(`/pois/${poiId}/outreach/audience`, input);
export const sendOutreach = (poiId: string, input: OutreachInput) => apiPost<OutreachView>(`/pois/${poiId}/outreach`, input);
export const sendOutreachTest = (poiId: string, input: OutreachInput) =>
  apiPost<{ to: string }>(`/pois/${poiId}/outreach/test`, input);
