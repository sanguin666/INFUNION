import { apiDelete, apiGet, apiPost } from './client';

export type ReportKind = 'post' | 'comment' | 'prayer';
export type ReportReason = 'spam' | 'hateful' | 'harassment' | 'inappropriate' | 'other';

export type HiddenPerson = { id: string; name: string | null; createdAt: string };

export function reportContent(
  poiId: string,
  body: { kind: ReportKind; targetId: string; reason: ReportReason },
): Promise<{ ok: true }> {
  return apiPost(`/pois/${encodeURIComponent(poiId)}/reports`, body);
}

export function hidePerson(body: { kind: ReportKind; targetId: string }): Promise<{ id: string; name: string | null }> {
  return apiPost('/auth/me/hidden-people', body);
}

export function getHiddenPeople(): Promise<HiddenPerson[]> {
  return apiGet<HiddenPerson[]>('/auth/me/hidden-people');
}

export function showPersonAgain(id: string): Promise<void> {
  return apiDelete(`/auth/me/hidden-people/${encodeURIComponent(id)}`);
}
