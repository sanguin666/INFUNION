import { apiDelete, apiGet, apiPost } from './client';

export type MemberRow = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  // Members who sign in by email have one instead of (or as well as) a phone.
  email: string | null;
  joinedAt: string;
  lastMessage: { body: string; fromStaff: boolean; createdAt: string } | null;
  // The member wrote since the office last opened the conversation.
  unread: boolean;
};

export type MemberMessage = {
  id: string;
  fromStaff: boolean;
  authorName: string | null;
  body: string;
  createdAt: string;
};

export type MemberConversation = {
  member: Omit<MemberRow, 'lastMessage' | 'unread'>;
  messages: MemberMessage[];
};

/** What the backend answers while the Messages module is off. */
export const MODULE_OFF = 'messages_module_off';

export function getMembers(poiId: string): Promise<MemberRow[]> {
  return apiGet<MemberRow[]>(`/pois/${poiId}/members`);
}

export function getMemberConversation(poiId: string, userId: string): Promise<MemberConversation> {
  return apiGet<MemberConversation>(`/pois/${poiId}/members/${userId}/messages`);
}

export function sendMemberMessage(poiId: string, userId: string, body: string): Promise<MemberConversation> {
  return apiPost<MemberConversation>(`/pois/${poiId}/members/${userId}/messages`, { body });
}

/** What this member did in this place, for the office to hand them (GDPR art. 15). */
export function exportMemberData(poiId: string, userId: string): Promise<unknown> {
  return apiGet<unknown>(`/pois/${poiId}/members/${userId}/export`);
}

/** Ends the membership and erases what they wrote here, at their request. */
export function removeMemberData(poiId: string, userId: string): Promise<void> {
  return apiDelete<void>(`/pois/${poiId}/members/${userId}`);
}
