import { apiGet, apiPost } from './client';

export type AssistantTurn = { role: 'member' | 'assistant'; text: string };

// Where an answer can send the member: a module's screen, or one of these.
export type AssistantAction = string;

export type AssistantStatus = { available: boolean; remaining: number };
export type AssistantAnswer = { answer: string; actions: AssistantAction[]; remaining: number };

export function getAssistantStatus(poiId: string): Promise<AssistantStatus> {
  return apiGet(`/pois/${encodeURIComponent(poiId)}/assistant`);
}

export function askAssistant(
  poiId: string,
  body: { turns: AssistantTurn[]; language: string },
): Promise<AssistantAnswer> {
  return apiPost(`/pois/${encodeURIComponent(poiId)}/assistant`, body);
}
