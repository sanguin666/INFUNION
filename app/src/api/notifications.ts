import { apiDelete, apiGet, apiPatch, apiPost, apiPut, isSignedIn } from './client';

// Signed in, the person's own routes; without an account, the phone's
// (the backend knows it by its push token, sent by the client).
const base = () => (isSignedIn() ? '/auth/me' : '/devices');

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
  return apiPost<void>(`${base()}/push-tokens`, { token, language, timeZone });
}

export function removePushToken(token: string): Promise<void> {
  if (!isSignedIn()) return apiDelete('/devices/push-tokens');
  return apiDelete(`/auth/me/push-tokens/${encodeURIComponent(token)}`);
}

/** Without an account: this phone follows a community, or stops. */
export function followFromPhone(poiId: string): Promise<void> {
  return apiPut(`/devices/pois/${encodeURIComponent(poiId)}`);
}

export function unfollowFromPhone(poiId: string): Promise<void> {
  return apiDelete(`/devices/pois/${encodeURIComponent(poiId)}`);
}

export function getNotificationPreferences(poiId: string): Promise<NotificationPreferences> {
  return apiGet<NotificationPreferences>(`${base()}/pois/${encodeURIComponent(poiId)}/notifications`);
}

export function updateNotificationPreferences(
  poiId: string,
  change: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return apiPatch<NotificationPreferences>(`${base()}/pois/${encodeURIComponent(poiId)}/notifications`, change);
}

/**
 * A bell someone rang: an hour before the event, and for a repeating one
 * before every time it happens, unless `onlyDate` (YYYY-MM-DD) limits it
 * to that one day.
 */
export type EventReminder = { eventId: string; onlyDate: string | null };

/** The events in a place whose bell is on. */
export function getEventReminders(poiId: string): Promise<EventReminder[]> {
  return apiGet<EventReminder[]>(`${base()}/pois/${encodeURIComponent(poiId)}/event-reminders`);
}

/** Rings the bell (every time, or on `onlyDate` alone), or with `null` stops it. */
export function setEventReminder(eventId: string, reminder: { onlyDate: string | null } | null): Promise<void> {
  const path = `${base()}/event-reminders/${encodeURIComponent(eventId)}`;
  if (!reminder) return apiDelete(path);
  return apiPut(path, reminder.onlyDate ? { onlyDate: reminder.onlyDate } : {});
}
