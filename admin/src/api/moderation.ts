import { apiDelete, apiGet, apiPost } from './client';

export type ReportKind = 'post' | 'comment' | 'prayer';
export type ReportReason = 'spam' | 'hateful' | 'harassment' | 'inappropriate' | 'other';
export type ResolveAction = 'remove' | 'keep' | 'remove_and_ban';

/** One reported item, however many members reported it. */
export type OpenReport = {
  kind: ReportKind;
  targetId: string;
  postId: string | null;
  excerpt: string;
  authorName: string | null;
  canBan: boolean;
  contentCreatedAt: string | null;
  firstReportedAt: string;
  count: number;
  reasons: Partial<Record<ReportReason, number>>;
  reason: ReportReason;
};

export type PostingBan = { id: string; name: string; createdAt: string };

export function getOpenReports(poiId: string, area: 'community' | 'prayer'): Promise<OpenReport[]> {
  return apiGet<OpenReport[]>(`/pois/${poiId}/reports?area=${area}`);
}

export function resolveReport(
  poiId: string,
  body: { kind: ReportKind; targetId: string; action: ResolveAction },
): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>(`/pois/${poiId}/reports/resolve`, body);
}

export function getPostingBans(poiId: string): Promise<PostingBan[]> {
  return apiGet<PostingBan[]>(`/pois/${poiId}/posting-bans`);
}

export function liftPostingBan(poiId: string, id: string): Promise<void> {
  return apiDelete<void>(`/pois/${poiId}/posting-bans/${id}`);
}

export function getReportCount(poiId: string): Promise<{ total: number; community: number; prayer: number }> {
  return apiGet(`/pois/${poiId}/reports/count`);
}
