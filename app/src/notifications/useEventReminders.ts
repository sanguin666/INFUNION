import { useEffect, useState } from 'react';
import { getEventReminders, setEventReminder } from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { dayKey } from '../utils/schedule';
import { enablePush, followAsGuest, pushSupported } from './push';

/**
 * The bells the reader rang in a place, for the Events tab and the
 * calendar: event id to the one day it is limited to, or null for every
 * time the event happens. Changes show at once and are put back if the
 * backend says no.
 */
export function useEventReminders(poiId: string) {
  const { me } = useAuth();
  const { language } = useI18n();
  const [reminders, setReminders] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!me && !pushSupported) return;
    let cancelled = false;
    // Without an account, only once this phone is registered.
    (me ? Promise.resolve(true) : followAsGuest(poiId, language))
      .then((ready) => (ready ? getEventReminders(poiId) : []))
      .then((list) => {
        if (!cancelled) setReminders(new Map(list.map((r) => [r.eventId, r.onlyDate])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [poiId, me?.id]);

  /** Whether a bell is on for this event (on `day`, for a one-day bell). */
  function isOn(eventId: string, day?: Date): boolean {
    if (!reminders.has(eventId)) return false;
    const only = reminders.get(eventId);
    return !only || (day !== undefined && only === dayKey(day));
  }

  /** Whether the bell rings before every time, not just one day. */
  function isEveryTime(eventId: string): boolean {
    return reminders.has(eventId) && !reminders.get(eventId);
  }

  function put(eventId: string, value: string | null | undefined) {
    setReminders((current) => {
      const next = new Map(current);
      if (value === undefined) next.delete(eventId);
      else next.set(eventId, value);
      return next;
    });
  }

  /** `onlyDate` null for every time, a day for that day alone, undefined to stop. */
  async function set(eventId: string, onlyDate: string | null | undefined) {
    const before = reminders.has(eventId) ? reminders.get(eventId) : undefined;
    put(eventId, onlyDate);
    try {
      // Without an account the phone is who rings the bell, so it has to
      // be allowed notifications and registered first.
      if (!me && onlyDate !== undefined) {
        if ((await enablePush(language)) !== 'granted' || !(await followAsGuest(poiId, language))) {
          put(eventId, before);
          return;
        }
      }
      await setEventReminder(eventId, onlyDate === undefined ? null : { onlyDate });
      // A bell is a request for a notification: the moment to ask the
      // phone, if it never has been.
      if (onlyDate !== undefined) await enablePush(language);
    } catch {
      put(eventId, before);
    }
  }

  return { isOn, isEveryTime, set, count: reminders.size, has: (eventId: string) => reminders.has(eventId) };
}
