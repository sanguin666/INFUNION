import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type { CurrentUser, SupportedLanguage } from './types';

export function login(email: string, password: string): Promise<{ accessToken: string }> {
  return apiPost<{ accessToken: string }>('/auth/login', { email, password });
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me');
}

export function updateMyLanguage(language: SupportedLanguage): Promise<{ language: SupportedLanguage }> {
  return apiPatch<{ language: SupportedLanguage }>('/auth/me/language', { language });
}

/** One tip of the welcome tour or a page seen: not shown again. */
export function markTipSeen(key: string): Promise<{ seenTips: string[] }> {
  return apiPost<{ seenTips: string[] }>('/auth/me/tips', { key });
}

/** Settings' "Show the tour and tips again". */
export function resetTips(): Promise<{ seenTips: string[] }> {
  return apiDelete<{ seenTips: string[] }>('/auth/me/tips');
}
