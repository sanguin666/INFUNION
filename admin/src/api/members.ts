import { apiGet, apiPost } from './client';

export type MemberRow = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
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
