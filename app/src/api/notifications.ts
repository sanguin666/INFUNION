import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';

export type NotificationPreferences = {
  news: boolean;
  requests: boolean;
  events: boolean;
  live: boolean;
  readings: boolean;
  messages: boolean;
};

export type NotificationKind = keyof NotificationPreferences;

export function registerPushToken(token: string, language: string, timeZone?: string): Promise<void> {
  return apiPost<void>('/auth/me/push-tokens', { token, language, timeZone });
}

export function removePushToken(token: string): Promise<void> {
  return apiDelete(`/auth/me/push-tokens/${encodeURIComponent(token)}`);
}

export function getNotificationPreferences(poiId: string): Promise<NotificationPreferences> {
  return apiGet<NotificationPreferences>(`/auth/me/pois/${encodeURIComponent(poiId)}/notifications`);
}

export function updateNotificationPreferences(
  poiId: string,
  change: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return apiPatch<NotificationPreferences>(`/auth/me/pois/${encodeURIComponent(poiId)}/notifications`, change);
}

/**
 * A bell someone rang: an hour before the event, and for a repeating one
 * before every time it happens, unless `onlyDate` (YYYY-MM-DD) limits it
 * to that one day.
 */
export type EventReminder = { eventId: string; onlyDate: string | null };

/** The events in a place whose bell is on. */
export function getEventReminders(poiId: string): Promise<EventReminder[]> {
  return apiGet<EventReminder[]>(`/auth/me/pois/${encodeURIComponent(poiId)}/event-reminders`);
}

/** Rings the bell (every time, or on `onlyDate` alone), or with `null` stops it. */
export function setEventReminder(eventId: string, reminder: { onlyDate: string | null } | null): Promise<void> {
  const path = `/auth/me/event-reminders/${encodeURIComponent(eventId)}`;
  if (!reminder) return apiDelete(path);
  return apiPut(path, reminder.onlyDate ? { onlyDate: reminder.onlyDate } : {});
}
