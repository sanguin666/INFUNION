import { useEffect, useState, type FormEvent } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { getPoi } from '../api/pois';
import { createEvent, deleteEvent, getEvents, updateEvent, type EventInput } from '../api/events';
import type { Event, EventCategory, EventException } from '../api/types';
import { weekdaysOf } from '../schedule';
import { DestructiveButton } from '../components/DestructiveButton';
import {
  endOfDayFromDateInput,
  fromLocalInputValue,
  toDateInputValue,
  toLocalInputValue,
} from '../format';

const CATEGORIES: EventCategory[] = ['mass', 'confession', 'adoration', 'prayer', 'office_hours', 'other'];
// Masses, confessions and adoration only make sense for a church (Seb,
// 27 Oct 2026); other places get the rest.
const CHURCH_ONLY: EventCategory[] = ['mass', 'confession', 'adoration'];

// How often, as the form asks it. "Every day" and "some days" are both a
// weekly event to the API, one with all seven days.
type Repeat = 'none' | 'daily' | 'days' | 'monthly';

// What the form holds, in the shapes the inputs want: local
// "YYYY-MM-DDTHH:mm" for the start, "HH:mm" for the end (the same day),
// "YYYY-MM-DD" for the last day and the days off of a repeating event.
type Draft = {
  title: string;
  category: EventCategory;
  startsAt: string;
  endTime: string;
  repeat: Repeat;
  repeatDays: number[];
  monthlyBy: 'weekday' | 'date';
  monthlyWeek: number;
  monthlyWeekday: number;
  monthlyDay: number;
  repeatUntil: string;
  exceptions: EventException[];
  // A day off being typed, not yet added to the list.
  newExceptionDate: string;
  newExceptionReason: string;
  location: string;
  description: string;
};

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 0];

const EMPTY_DRAFT: Draft = {
  title: '',
  category: 'other',
  startsAt: '',
  endTime: '',
  repeat: 'none',
  repeatDays: [],
  monthlyBy: 'weekday',
  monthlyWeek: 1,
  monthlyWeekday: 0,
  monthlyDay: 1,
  repeatUntil: '',
  exceptions: [],
  newExceptionDate: '',
  newExceptionReason: '',
  location: '',
  description: '',
};

function repeatOf(item: Event): Repeat {
  if (item.recurrence === 'monthly') return 'monthly';
  if (item.recurrence === 'weekly') return item.repeatDays?.length === 7 ? 'daily' : 'days';
  return 'none';
}

function draftFrom(item: Event): Draft {
  const start = new Date(item.startsAt);
  return {
    title: item.title,
    category: item.category,
    startsAt: toLocalInputValue(item.startsAt),
    endTime: item.endsAt ? toLocalInputValue(item.endsAt).slice(11) : '',
    repeat: repeatOf(item),
    repeatDays: item.recurrence === 'weekly' ? weekdaysOf(item) : [],
    monthlyBy: item.monthlyDay ? 'date' : 'weekday',
    monthlyWeek: item.monthlyWeek ?? Math.min(4, Math.ceil(start.getDate() / 7)),
    monthlyWeekday: item.monthlyWeekday ?? start.getDay(),
    monthlyDay: item.monthlyDay ?? start.getDate(),
    repeatUntil: item.repeatUntil ? toDateInputValue(item.repeatUntil) : '',
    exceptions: item.exceptions ?? [],
    newExceptionDate: '',
    newExceptionReason: '',
    location: item.location ?? '',
    description: item.description ?? '',
  };
}

// The end is asked as a time on the start's day; one earlier than the
// start (a vigil until 1:00) is taken to be the next morning.
function endsAtFrom(draft: Draft): string | null {
  if (!draft.endTime || !draft.startsAt) return null;
  const end = new Date(`${draft.startsAt.slice(0, 10)}T${draft.endTime}`);
  if (end <= new Date(draft.startsAt)) end.setDate(end.getDate() + 1);
  return end.toISOString();
}

// The days off, with the one still being typed: somebody who picked a
// date and pressed Save meant it, even without pressing Add.
function exceptionsOf(draft: Draft): EventException[] {
  const typed = draft.newExceptionDate
    ? [{ date: draft.newExceptionDate, reason: draft.newExceptionReason.trim() || null }]
    : [];
  return [...draft.exceptions.filter((e) => e.date !== draft.newExceptionDate), ...typed];
}

// null clears endsAt / repeatUntil, which is what an edit wants when a
// field was emptied; a new event simply has none.
function inputFrom(draft: Draft): EventInput {
  const repeating = draft.repeat !== 'none';
  const monthly = draft.repeat === 'monthly';
  const byDate = monthly && draft.monthlyBy === 'date';
  return {
    title: draft.title.trim(),
    startsAt: fromLocalInputValue(draft.startsAt),
    endsAt: endsAtFrom(draft),
    location: draft.location.trim(),
    description: draft.description.trim(),
    category: draft.category,
    recurrence: monthly ? 'monthly' : repeating ? 'weekly' : 'none',
    repeatDays: draft.repeat === 'daily' ? ALL_DAYS : draft.repeat === 'days' ? draft.repeatDays : [],
    monthlyWeek: monthly && !byDate ? draft.monthlyWeek : null,
    monthlyWeekday: monthly && !byDate ? draft.monthlyWeekday : null,
    monthlyDay: byDate ? draft.monthlyDay : null,
    repeatUntil: repeating && draft.repeatUntil ? endOfDayFromDateInput(draft.repeatUntil) : null,
    exceptions: repeating ? exceptionsOf(draft) : [],
  };
}

// "2026-11-11" as "Wednesday 11 November", in the admin's language.
function exceptionDay(date: string, language: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString(intlLocale(language), { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function weekdayName(day: number, language: string, style: 'long' | 'narrow' = 'long'): string {
  // 6 September 2026 is a Sunday.
  return new Date(2026, 8, 6 + day, 12).toLocaleDateString(intlLocale(language), { weekday: style });
}

const sameDays = (a: number[], b: number[]) => a.length === b.length && b.every((day) => a.includes(day));

/**
 * How an event repeats, the way someone would say it: "Monday to Friday",
 * "Every Sunday", "The first Friday of the month", or a date.
 */
function repeatPhrase(
  item: Pick<Event, 'recurrence' | 'startsAt' | 'repeatDays' | 'monthlyWeek' | 'monthlyWeekday' | 'monthlyDay'>,
  t: T,
  language: string,
): string {
  if (item.recurrence === 'monthly') {
    if (item.monthlyDay) return t('events.monthlyDay', { day: item.monthlyDay });
    return t('events.monthlyNth', {
      nth: t(NTH_KEYS[String(item.monthlyWeek)] ?? 'events.nth_1'),
      weekday: weekdayName(item.monthlyWeekday ?? 0, language),
    });
  }
  const days = weekdaysOf(item);
  if (days.length === 7) return t('events.everyDay');
  if (sameDays(days, WEEKDAYS)) return t('events.weekdaysOnly');
  if (sameDays(days, WEEKEND)) return t('events.weekendOnly');
  const names = ALL_DAYS.filter((day) => days.includes(day)).map((day) => weekdayName(day, language));
  return t('events.everyWeekday', { day: names.join(', ') });
}

type T = ReturnType<typeof useI18n>['t'];

const NTH_KEYS: Record<string, 'events.nth_1' | 'events.nth_2' | 'events.nth_3' | 'events.nth_4' | 'events.nth_last'> = {
  '1': 'events.nth_1',
  '2': 'events.nth_2',
  '3': 'events.nth_3',
  '4': 'events.nth_4',
  '-1': 'events.nth_last',
};

/**
 * "Monday to Friday · 08:30 – 09:00 · from 1 September · except
 * 11 November", or the date of a one-off event, then where.
 */
function whenLine(item: Event, t: T, language: string): string {
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(intlLocale(language), { hour: '2-digit', minute: '2-digit' });
  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' });
  const end = item.endsAt ? ` – ${timeOf(item.endsAt)}` : '';
  const exceptions = item.exceptions ?? [];
  const parts =
    item.recurrence !== 'none'
      ? [
          repeatPhrase(item, t, language),
          `${timeOf(item.startsAt)}${end}`,
          new Date(item.startsAt) > new Date() ? t('events.fromDate', { date: dateOf(item.startsAt) }) : null,
          item.repeatUntil ? t('events.untilDate', { date: dateOf(item.repeatUntil) }) : null,
          exceptions.length
            ? t('events.exceptDates', {
                dates: exceptions.map((e) => exceptionDay(e.date, language).replace(/^\S+\s/, '')).join(', '),
              })
            : null,
        ]
      : [`${dateOf(item.startsAt)}, ${timeOf(item.startsAt)}${end}`];
  return [...parts, item.location].filter(Boolean).join(' · ');
}

// Repeating events in the order of the week (Monday first), then by time;
// monthly ones after.
function weekOrder(item: Event): number {
  const d = new Date(item.startsAt);
  const first = item.recurrence === 'monthly' ? 7 : (Math.min(...weekdaysOf(item).map((day) => (day + 6) % 7)));
  return first * 24 * 60 + d.getHours() * 60 + d.getMinutes();
}

function canSave(draft: Draft): boolean {
  return Boolean(draft.title.trim() && draft.startsAt && (draft.repeat !== 'days' || draft.repeatDays.length));
}

function EventFields({
  draft,
  onChange,
  isChurch,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  isChurch: boolean;
}) {
  // An event already filed under a church category keeps it on offer.
  const categories = CATEGORIES.filter((c) => isChurch || !CHURCH_ONLY.includes(c) || c === draft.category);
  const { t, language } = useI18n();
  const repeating = draft.repeat !== 'none';
  const start = draft.startsAt ? new Date(draft.startsAt) : null;

  function setRepeat(repeat: Repeat) {
    const patch: Partial<Draft> = { repeat };
    // Start from the weekday and date of the first day, which is usually
    // what was meant.
    if (repeat === 'days' && draft.repeatDays.length === 0) patch.repeatDays = [start ? start.getDay() : 0];
    if (repeat === 'monthly' && start) {
      patch.monthlyWeek = Math.min(4, Math.ceil(start.getDate() / 7));
      patch.monthlyWeekday = start.getDay();
      patch.monthlyDay = start.getDate();
    }
    onChange(patch);
  }

  function toggleDay(day: number) {
    const on = draft.repeatDays.includes(day);
    onChange({ repeatDays: on ? draft.repeatDays.filter((d) => d !== day) : [...draft.repeatDays, day] });
  }

  function addException() {
    if (!draft.newExceptionDate) return;
    onChange({ exceptions: exceptionsOf(draft).sort((a, b) => a.date.localeCompare(b.date)), newExceptionDate: '', newExceptionReason: '' });
  }

  const input = draft.startsAt ? inputFrom(draft) : null;
  const preview: Event | null = input
    ? {
        ...input,
        id: '',
        title: draft.title,
        location: null,
        description: null,
        category: draft.category,
        recurrence: input.recurrence ?? 'none',
        endsAt: input.endsAt ?? null,
        repeatUntil: input.repeatUntil ?? null,
      }
    : null;

  return (
    <>
      <label>
        {t('events.titleLabel')}
        <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })} required />
      </label>
      <label>
        {t('events.categoryLabel')}
        <select value={draft.category} onChange={(e) => onChange({ category: e.target.value as EventCategory })}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {categoryName(category, t)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('events.recurrenceLabel')}
        <select value={draft.repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
          <option value="none">{t('events.recurrenceNone')}</option>
          <option value="daily">{t('events.recurrenceDaily')}</option>
          <option value="days">{t('events.recurrenceDays')}</option>
          <option value="monthly">{t('events.recurrenceMonthly')}</option>
        </select>
      </label>
      {draft.repeat === 'days' && (
        <div className="form-row">
          {t('events.daysLabel')}
          <div className="day-chips" role="group" aria-label={t('events.daysLabel')}>
            {ALL_DAYS.map((day) => {
              const on = draft.repeatDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={on ? 'day-chip day-chip-on' : 'day-chip'}
                  aria-pressed={on}
                  aria-label={weekdayName(day, language)}
                  title={weekdayName(day, language)}
                  onClick={() => toggleDay(day)}
                >
                  {weekdayName(day, language, 'narrow').toLocaleUpperCase()}
                </button>
              );
            })}
          </div>
          <div className="day-shortcuts">
            <button type="button" className="link-button" onClick={() => onChange({ repeatDays: ALL_DAYS })}>
              {t('events.shortcutAll')}
            </button>
            <button type="button" className="link-button" onClick={() => onChange({ repeatDays: WEEKDAYS })}>
              {t('events.shortcutWeekdays')}
            </button>
            <button type="button" className="link-button" onClick={() => onChange({ repeatDays: WEEKEND })}>
              {t('events.shortcutWeekend')}
            </button>
          </div>
          {draft.repeatDays.length === 0 && <span className="error-text">{t('events.noDays')}</span>}
        </div>
      )}
      {draft.repeat === 'monthly' && (
        <>
          <label>
            {t('events.monthlyLabel')}
            <select
              value={draft.monthlyBy}
              onChange={(e) => onChange({ monthlyBy: e.target.value as Draft['monthlyBy'] })}
            >
              <option value="weekday">{t('events.monthlyByWeekday')}</option>
              <option value="date">{t('events.monthlyByDate')}</option>
            </select>
          </label>
          {draft.monthlyBy === 'weekday' ? (
            <div className="form-row">
              {t('events.monthlyNth', {
                nth: t(NTH_KEYS[String(draft.monthlyWeek)]),
                weekday: weekdayName(draft.monthlyWeekday, language),
              })}
              <div className="inline-selects">
                <select
                  aria-label={t('events.monthlyByWeekday')}
                  value={draft.monthlyWeek}
                  onChange={(e) => onChange({ monthlyWeek: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, -1].map((week) => (
                    <option key={week} value={week}>
                      {t(NTH_KEYS[String(week)])}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t('events.daysLabel')}
                  value={draft.monthlyWeekday}
                  onChange={(e) => onChange({ monthlyWeekday: Number(e.target.value) })}
                >
                  {ALL_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {weekdayName(day, language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <label>
              {t('events.dayOfMonthLabel')}
              <input
                type="number"
                min={1}
                max={31}
                value={draft.monthlyDay}
                onChange={(e) => onChange({ monthlyDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </label>
          )}
        </>
      )}
      <label>
        {repeating ? t('events.firstStartsAtLabel') : t('events.startsAtLabel')}
        <input
          type="datetime-local"
          value={draft.startsAt}
          onChange={(e) => onChange({ startsAt: e.target.value })}
          required
        />
      </label>
      <label>
        {t('events.endTimeLabel')}
        <input type="time" value={draft.endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
      </label>
      {repeating && (
        <label>
          {t('events.repeatUntilLabel')}
          <input
            type="date"
            value={draft.repeatUntil}
            min={draft.startsAt.slice(0, 10) || undefined}
            onChange={(e) => onChange({ repeatUntil: e.target.value })}
          />
        </label>
      )}
      {repeating && (
        <div className="form-row">
          {t('events.exceptionsLabel')}
          {draft.exceptions.map((exception) => (
            <div key={exception.date} className="exception-row">
              <div>
                <span className="exception-day">{exceptionDay(exception.date, language)}</span>
                {exception.reason && <span className="exception-reason">{exception.reason}</span>}
              </div>
              <button
                type="button"
                className="link-button"
                onClick={() => onChange({ exceptions: draft.exceptions.filter((e) => e.date !== exception.date) })}
              >
                {t('events.removeException')}
              </button>
            </div>
          ))}
          <div className="exception-new">
            <input
              type="date"
              aria-label={t('events.exceptionsLabel')}
              value={draft.newExceptionDate}
              min={draft.startsAt.slice(0, 10) || undefined}
              onChange={(e) => onChange({ newExceptionDate: e.target.value })}
            />
            <input
              aria-label={t('events.exceptionReasonPlaceholder')}
              placeholder={t('events.exceptionReasonPlaceholder')}
              value={draft.newExceptionReason}
              maxLength={120}
              onChange={(e) => onChange({ newExceptionReason: e.target.value })}
            />
          </div>
          <button type="button" className="link-button" disabled={!draft.newExceptionDate} onClick={addException}>
            {t('events.addException')}
          </button>
        </div>
      )}
      <label>
        {t('events.locationLabel')}
        <input value={draft.location} onChange={(e) => onChange({ location: e.target.value })} />
      </label>
      <label>
        {t('events.descriptionLabel')}
        <textarea value={draft.description} onChange={(e) => onChange({ description: e.target.value })} />
      </label>
      {repeating && preview && (
        <p className="event-summary">
          {t('events.summaryLabel')} : <strong>{whenLine(preview, t, language)}</strong>
        </p>
      )}
    </>
  );
}

export function EventsPage() {
  const poiId = usePoiId();
  const { t, language } = useI18n();
  const [items, setItems] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [isChurch, setIsChurch] = useState(false);

  useEffect(() => {
    getPoi(poiId)
      .then((poi) => setIsChurch(poi.type === 'church'))
      .catch(() => setIsChurch(false));
  }, [poiId]);

  function load() {
    getEvents(poiId)
      .then(setItems)
      .catch(() => setError(t('events.loadError')));
  }

  useEffect(load, [poiId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canSave(draft)) return;
    setSubmitting(true);
    try {
      const input = inputFrom(draft);
      const created = await createEvent(poiId, {
        ...input,
        location: input.location || undefined,
        description: input.description || undefined,
      });
      setItems((current) => [...(current ?? []), created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setDraft(EMPTY_DRAFT);
    } catch {
      setError(t('events.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: Event) {
    setEditingId(item.id);
    setEditDraft(draftFrom(item));
  }

  async function saveEdit(id: string) {
    if (!canSave(editDraft)) return;
    try {
      const updated = await updateEvent(poiId, id, inputFrom(editDraft));
      setItems(
        (current) =>
          current
            ?.map((e) => (e.id === id ? updated : e))
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt)) ?? null,
      );
      setEditingId(null);
    } catch {
      setError(t('events.saveError'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEvent(poiId, id);
      setItems((current) => current?.filter((e) => e.id !== id) ?? null);
    } catch {
      setError(t('events.deleteError'));
    }
  }

  function renderItem(item: Event) {
    if (editingId === item.id) {
      return (
        <div key={item.id} className="card form">
          <EventFields isChurch={isChurch} draft={editDraft} onChange={(patch) => setEditDraft((d) => ({ ...d, ...patch }))} />
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSave(editDraft)}
              onClick={() => saveEdit(item.id)}
            >
              {t('events.save')}
            </button>
            <button type="button" className="btn" onClick={() => setEditingId(null)}>
              {t('events.cancel')}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div key={item.id} className="card">
        <p className="card-title">{item.title}</p>
        {item.category !== 'other' && <span className="badge">{categoryName(item.category, t)}</span>}
        <p className="card-meta">{whenLine(item, t, language)}</p>
        {item.description && <p>{item.description}</p>}
        <div className="card-actions">
          <button type="button" className="btn" onClick={() => startEdit(item)}>
            {t('events.edit')}
          </button>
          <DestructiveButton label={t('events.delete')} onConfirm={() => handleDelete(item.id)} />
        </div>
      </div>
    );
  }

  const weekly = items?.filter((e) => e.recurrence !== 'none').sort((a, b) => weekOrder(a) - weekOrder(b)) ?? [];
  const once = items?.filter((e) => e.recurrence === 'none') ?? [];

  return (
    <div>
      <h2>{t('events.title')}</h2>
      <p className="muted">{t('events.subtitle')}</p>

      <form className="form card" onSubmit={handleCreate}>
        <EventFields isChurch={isChurch} draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !canSave(draft)}
        >
          {submitting ? t('events.scheduling') : t('events.schedule')}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <p className="muted">{t('events.loading')}</p>}
      {items?.length === 0 && !error && <p className="muted">{t('events.empty')}</p>}

      {weekly.length > 0 && (
        <>
          <h3>{t('events.weeklyHeading')}</h3>
          <p className="muted">{t('events.weeklyHint')}</p>
          {weekly.map(renderItem)}
        </>
      )}

      {once.length > 0 && (
        <>
          {weekly.length > 0 && <h3>{t('events.onceHeading')}</h3>}
          {once.map(renderItem)}
        </>
      )}
    </div>
  );
}

function categoryName(category: EventCategory, t: T): string {
  switch (category) {
    case 'mass':
      return t('events.categoryMass');
    case 'confession':
      return t('events.categoryConfession');
    case 'adoration':
      return t('events.categoryAdoration');
    case 'prayer':
      return t('events.categoryPrayer');
    case 'office_hours':
      return t('events.categoryOfficeHours');
    case 'other':
      return t('events.categoryOther');
  }
}
