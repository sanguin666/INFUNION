import { apiGet, apiPost } from './client';

/** One message between the member and the place's office. */
export type MemberMessage = {
  id: string;
  fromStaff: boolean;
  authorName: string | null;
  body: string;
  createdAt: string;
};

const base = (poiId: string) => `/pois/${encodeURIComponent(poiId)}/messages/mine`;

// Opening marks the office's messages read.
export function getMyMessages(poiId: string): Promise<MemberMessage[]> {
  return apiGet<MemberMessage[]>(base(poiId));
}

export function sendMyMessage(poiId: string, body: string): Promise<MemberMessage[]> {
  return apiPost<MemberMessage[]>(base(poiId), { body });
}

/** For the dot on the menu; marks nothing read. */
export function getMessagesUnread(poiId: string): Promise<{ unread: boolean }> {
  return apiGet<{ unread: boolean }>(`${base(poiId)}/unread`);
}
