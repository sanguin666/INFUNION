import { apiGet, apiPost } from './client';

export type AssistantTurn = { role: 'member' | 'assistant'; text: string };
export type AdminAssistantStatus = { available: boolean; remaining: number };
export type AdminAssistantAnswer = { answer: string; actions: string[]; remaining: number };

export const getAdminAssistant = (poiId: string) =>
  apiGet<AdminAssistantStatus>(`/pois/${encodeURIComponent(poiId)}/admin-assistant`);

export const askAdminAssistant = (poiId: string, turns: AssistantTurn[], language: string) =>
  apiPost<AdminAssistantAnswer>(`/pois/${encodeURIComponent(poiId)}/admin-assistant`, { turns, language });
