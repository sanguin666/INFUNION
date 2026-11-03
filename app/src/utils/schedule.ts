import type { Event, EventCategory, EventException } from '../api/types';

/**
 * A place's timetable. A repeating event is stored once: `startsAt` is the
 * first day it can happen and the time it starts at every time, and its
 * rule says which days it falls on: chosen weekdays, or once a month (the
 * first Friday, the last Saturday, the 15th). It stops after
 * `repeatUntil` and skips the days in `exceptions`. All of it is worked
 * out here, on the phone, in the phone's own time zone, so "Sunday 10:00"
 * stays 10:00 on either side of a clock change.
 */

export type Occurrence = {
  event: Event;
  startsAt: Date;
  endsAt: Date | null;
};

// The order a timetable lists its sections in.
export const CATEGORY_ORDER: EventCategory[] = [
  'mass',
  'confession',
  'adoration',
  'prayer',
  'office_hours',
  'other',
];

/** Whether an event happens more than once. */
export function repeats(event: Event): boolean {
  return event.recurrence === 'weekly' || event.recurrence === 'monthly';
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** "2026-11-11", the phone's own day, the way exceptions are stored. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function durationOf(event: Event): number {
  if (!event.endsAt) return 0;
  return Math.max(0, new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime());
}

function occurrence(event: Event, startsAt: Date): Occurrence {
  const duration = durationOf(event);
  return { event, startsAt, endsAt: event.endsAt ? new Date(startsAt.getTime() + duration) : null };
}

/** The weekdays a weekly event happens on (0 is Sunday). */
export function weekdaysOf(event: Event): number[] {
  return event.repeatDays?.length ? event.repeatDays : [new Date(event.startsAt).getDay()];
}

function fallsOnMonthly(event: Event, day: Date): boolean {
  if (event.monthlyDay) return day.getDate() === event.monthlyDay;
  if (event.monthlyWeek == null || event.monthlyWeekday == null) return false;
  if (day.getDay() !== event.monthlyWeekday) return false;
  // The last one is the one with no same weekday left in the month.
  if (event.monthlyWeek === -1) return addDays(day, 7).getMonth() !== day.getMonth();
  return Math.ceil(day.getDate() / 7) === event.monthlyWeek;
}

/**
 * Whether a repeating event's rule lands on `day`, between its first day
 * and `repeatUntil`, before taking its exceptions out.
 */
function fallsOn(event: Event, day: Date): boolean {
  if (startOfDay(new Date(event.startsAt)) > day) return false;
  if (event.repeatUntil && endOfDay(new Date(event.repeatUntil)) < day) return false;
  if (event.recurrence === 'monthly') return fallsOnMonthly(event, day);
  return weekdaysOf(event).includes(day.getDay());
}

/** The exception a repeating event has on `day`, if it skips that day. */
export function exceptionOn(event: Event, day: Date): EventException | undefined {
  const key = dayKey(day);
  return event.exceptions?.find((exception) => exception.date === key);
}

/** Whether an event happens on the day holding `day`. */
export function occursOn(event: Event, day: Date): boolean {
  const dayStart = startOfDay(day);
  if (!repeats(event)) return startOfDay(new Date(event.startsAt)).getTime() === dayStart.getTime();
  return fallsOn(event, dayStart) && !exceptionOn(event, dayStart);
}

// A repeating event's start on a given day: that day, at its usual time.
function startOn(event: Event, day: Date): Date {
  const first = new Date(event.startsAt);
  const start = new Date(day);
  start.setHours(first.getHours(), first.getMinutes(), 0, 0);
  return start;
}

/**
 * An event's occurrences that haven't finished by `now`, soonest first,
 * up to `limit` of them. One that is happening right now counts.
 */
export function occurrencesOf(event: Event, now: Date, limit: number): Occurrence[] {
  const first = new Date(event.startsAt);
  const duration = durationOf(event);
  const stillOn = (start: Date) => start.getTime() + duration >= now.getTime();

  if (!repeats(event)) {
    return stillOn(first) && limit > 0 ? [occurrence(event, first)] : [];
  }

  const until = event.repeatUntil ? endOfDay(new Date(event.repeatUntil)) : null;
  // Walk day by day from yesterday (something from last night may still
  // be on): setDate keeps the wall clock time, which a plain 24 h step
  // would lose at a clock change. A monthly event needs about a month a
  // time, so the walk goes that far before giving up.
  const firstDay = startOfDay(first);
  const yesterday = addDays(startOfDay(now), -1);
  let day = firstDay > yesterday ? firstDay : yesterday;
  const last = addDays(day, Math.max(400, limit * 32));
  const found: Occurrence[] = [];
  while (found.length < limit && day <= last) {
    if (until && day > until) break;
    if (fallsOn(event, day) && !exceptionOn(event, day)) {
      const start = startOn(event, day);
      if (stillOn(start)) found.push(occurrence(event, start));
    }
    day = addDays(day, 1);
  }
  return found;
}

/** Every event's next occurrences together, soonest first. */
export function upcomingOccurrences(
  events: Event[],
  now: Date,
  limit: number,
  filter: (event: Event) => boolean = () => true,
): Occurrence[] {
  return events
    .filter(filter)
    .flatMap((event) => occurrencesOf(event, now, limit))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, limit);
}

/** "08:30", from the phone's local time. */
export function timeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// One line of a timetable: a run of days that share the same times.
// `days` are JavaScript weekdays (0 is Sunday), in the order shown. A
// monthly line has no `days` but the rule it follows instead.
export type TimetableRow = { days: number[]; times: string[]; monthly?: MonthlyRule };

export type MonthlyRule = { week: number | null; weekday: number | null; day: number | null };

// A day a repeating event is off, coming up soon: "Wednesday 11 November
// at 08:30", with the reason the office gave, if any.
export type TimetableNote = { startsAt: Date; reason: string | null };

export type TimetableSection = { category: EventCategory; rows: TimetableRow[]; notes: TimetableNote[] };

// How far ahead a timetable warns about a day off.
const NOTE_DAYS = 45;

/** The repeating events that haven't stopped by `now`: the timetable's. */
export function regularEvents(events: Event[], now: Date): Event[] {
  return events.filter(
    (event) => repeats(event) && (!event.repeatUntil || endOfDay(new Date(event.repeatUntil)) >= now),
  );
}

/**
 * How a repeating event's time reads in the timetable. A Mass is a
 * moment; an open office or an hour of adoration is a stretch of time
 * someone can drop in on, so it shows when it ends.
 */
export function timetableTime(event: Event): string {
  const start = new Date(event.startsAt);
  const end = event.category !== 'mass' && event.endsAt ? new Date(event.endsAt) : null;
  return end ? `${timeKey(start)}–${timeKey(end)}` : timeKey(start);
}

/** Whether a timetable row lists this event (its days, or its monthly rule). */
export function rowHasEvent(row: TimetableRow, event: Event): boolean {
  if (row.monthly) {
    if (event.recurrence !== 'monthly') return false;
    if (event.monthlyDay) return row.monthly.day === event.monthlyDay;
    return row.monthly.week === (event.monthlyWeek ?? null) && row.monthly.weekday === (event.monthlyWeekday ?? null);
  }
  return event.recurrence === 'weekly' && weekdaysOf(event).some((day) => row.days.includes(day));
}

/**
 * The regular timetable, one section per kind of celebration, each line a
 * run of consecutive days with the same times: "Mon–Fri 08:30",
 * "Sun 10:00, 18:30", then the monthly ones: "First Friday of the month
 * 19:00". Weeks start on `firstDay` (1, Monday, in most of Europe).
 * Events already over are left out. Under each section, the days off
 * coming up in the next weeks.
 */
export function weeklyTimetable(events: Event[], now: Date, firstDay = 1): TimetableSection[] {
  const regular = regularEvents(events, now);
  const weekOrder = Array.from({ length: 7 }, (_, i) => (firstDay + i) % 7);
  const today = startOfDay(now);

  const sections: TimetableSection[] = [];
  for (const category of CATEGORY_ORDER) {
    const inCategory = regular.filter((event) => event.category === category);
    if (inCategory.length === 0) continue;

    const timeOf = timetableTime;

    const timesByDay = new Map<number, Set<string>>();
    const monthlyRows = new Map<string, TimetableRow>();
    for (const event of inCategory) {
      if (event.recurrence === 'monthly') {
        const monthly: MonthlyRule = {
          week: event.monthlyDay ? null : (event.monthlyWeek ?? null),
          weekday: event.monthlyDay ? null : (event.monthlyWeekday ?? null),
          day: event.monthlyDay ?? null,
        };
        const key = `${monthly.week}:${monthly.weekday}:${monthly.day}`;
        const row = monthlyRows.get(key) ?? { days: [], times: [], monthly };
        if (!row.times.includes(timeOf(event))) row.times.push(timeOf(event));
        row.times.sort();
        monthlyRows.set(key, row);
        continue;
      }
      for (const day of weekdaysOf(event)) {
        const times = timesByDay.get(day) ?? new Set<string>();
        times.add(timeOf(event));
        timesByDay.set(day, times);
      }
    }

    const rows: TimetableRow[] = [];
    for (const day of weekOrder) {
      const times = timesByDay.get(day);
      if (!times) continue;
      const sorted = [...times].sort();
      const previous = rows[rows.length - 1];
      const lastDay = previous?.days[previous.days.length - 1];
      const follows = lastDay !== undefined && weekOrder.indexOf(day) === weekOrder.indexOf(lastDay) + 1;
      if (previous && follows && previous.times.join() === sorted.join()) {
        previous.days.push(day);
      } else {
        rows.push({ days: [day], times: sorted });
      }
    }
    rows.push(...monthlyRows.values());

    // Only the days off that fall where the event would have been.
    const horizon = addDays(today, NOTE_DAYS);
    const notes: TimetableNote[] = [];
    for (const event of inCategory) {
      for (const exception of event.exceptions ?? []) {
        const [year, month, date] = exception.date.split('-').map(Number);
        const day = new Date(year, month - 1, date);
        if (day < today || day > horizon || !fallsOn(event, day)) continue;
        notes.push({ startsAt: startOn(event, day), reason: exception.reason?.trim() || null });
      }
    }
    notes.sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());

    sections.push({ category, rows, notes });
  }
  return sections;
}

// The locale weekday names are written in, from the app's language.
const DAY_LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', va: 'ca-ES', ca: 'ca-ES', gl: 'gl-ES', pt: 'pt-PT', fr: 'fr-FR' };

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** A JavaScript weekday (0 is Sunday) by name, in the app's language. */
export function weekdayName(day: number, language: string, style: 'long' | 'short' = 'long'): string {
  // 6 September 2026 is a Sunday; any week would do.
  const date = new Date(2026, 8, 6 + day, 12);
  return date.toLocaleDateString(DAY_LOCALES[language] ?? language, { weekday: style });
}

/**
 * The heading over a day's rows in a list: "Hoy", "Mañana", "Ayer", or
 * "Miércoles 30 sept", with the year only when it is not this one. The
 * caller supplies the words for today, tomorrow and yesterday.
 */
export function dayHeading(
  date: Date,
  now: Date,
  language: string,
  words: { today: string; tomorrow: string; yesterday: string },
): string {
  if (sameDay(date, now)) return words.today;
  if (sameDay(date, addDays(now, 1))) return words.tomorrow;
  if (sameDay(date, addDays(now, -1))) return words.yesterday;
  const locale = DAY_LOCALES[language] ?? language;
  const clean = (text: string) => text.replace(/\.$/, '');
  const parts = [
    capitalise(date.toLocaleDateString(locale, { weekday: 'long' })),
    String(date.getDate()),
    clean(date.toLocaleDateString(locale, { month: 'short' })),
  ];
  if (date.getFullYear() !== now.getFullYear()) parts.push(String(date.getFullYear()));
  return parts.join(' ');
}

/**
 * A timetable row's days: "Sunday", "Saturday, Sunday", or for three or
 * more in a row "Mon–Fri".
 */
export function formatDays(days: number[], language: string): string {
  if (days.length >= 3) {
    const first = weekdayName(days[0], language, 'short');
    const last = weekdayName(days[days.length - 1], language, 'short');
    return capitalise(`${first}–${last}`);
  }
  return capitalise(days.map((day) => weekdayName(day, language)).join(', '));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * When an occurrence is, the short way people say it: "Today", "Tomorrow",
 * the weekday within the week, a date after that, and just the date for
 * one already past (a message, say). The caller supplies the
 * words for today and tomorrow in the app's language.
 */
export function formatWhen(
  date: Date,
  now: Date,
  language: string,
  words: { today: string; tomorrow: string },
): string {
  const locale = DAY_LOCALES[language] ?? language;
  let day: string;
  if (sameDay(date, now)) day = words.today;
  else if (sameDay(date, addDays(now, 1))) day = words.tomorrow;
  else if (date > now && date.getTime() - now.getTime() < 6 * 86_400_000) {
    day = capitalise(weekdayName(date.getDay(), language));
  } else if (date > now) {
    day = capitalise(date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }));
  } else {
    // Something already said or done: its date is what matters.
    day = date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  }
  return `${day} · ${timeKey(date)}`;
}

/**
 * `formatWhen` as short as it goes, for a small tile: the caller's short
 * words for today and tomorrow, a short weekday within the week, and a
 * short date after that: "Sun 10:00", "12 Oct 10:00". Left in the case
 * the language writes it mid-sentence ("ouvre mar. 10:00"); a caller
 * starting a line with it capitalises it.
 */
export function formatShortWhen(
  date: Date,
  now: Date,
  language: string,
  words: { today: string; tomorrow: string },
): string {
  const locale = DAY_LOCALES[language] ?? language;
  let day: string;
  if (sameDay(date, now)) day = words.today;
  else if (sameDay(date, addDays(now, 1))) day = words.tomorrow;
  else if (date.getTime() - now.getTime() < 6 * 86_400_000) {
    day = weekdayName(date.getDay(), language, 'short');
  } else {
    day = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }
  return `${day} ${timeKey(date)}`;
}

/**
 * What happens on one day, in the phone's own time: every one-off event
 * that starts that day, and every repeating one whose rule lands on it,
 * less its days off. Earliest first. For the calendar.
 */
export function occurrencesOnDay(events: Event[], day: Date): Occurrence[] {
  const dayStart = startOfDay(day);
  const found: Occurrence[] = [];
  for (const event of events) {
    if (!occursOn(event, dayStart)) continue;
    found.push(occurrence(event, repeats(event) ? startOn(event, dayStart) : new Date(event.startsAt)));
  }
  return found.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** The first day (at midnight) of the week holding `date`. */
export function startOfWeek(date: Date, firstDay = 1): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() - firstDay + 7) % 7));
  return start;
}
