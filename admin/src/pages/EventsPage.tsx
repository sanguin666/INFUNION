import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { TabBar, TabPanel, useTab } from '../components/Tabs';
import { hideFromList, useUndo } from '../components/Undo';

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

function weekdayName(day: number, language: string, style: 'long' | 'short' | 'narrow' = 'long'): string {
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

// The event as it would be saved, for the preview beside the form.
function previewOf(draft: Draft): Event | null {
  if (!draft.startsAt) return null;
  const input = inputFrom(draft);
  return {
    ...input,
    id: '',
    title: draft.title,
    location: input.location || null,
    description: input.description || null,
    category: draft.category,
    recurrence: input.recurrence ?? 'none',
    endsAt: input.endsAt ?? null,
    repeatUntil: input.repeatUntil ?? null,
  };
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
    </>
  );
}

// Minutes after midnight, to order a day's events.
function minuteOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function EventsPage() {
  const poiId = usePoiId();
  const { t, language } = useI18n();
  const [items, setItems] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // Which event the draft was filled from ('new' for a new one).
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isChurch, setIsChurch] = useState(false);
  const [tab, setTab] = useTab(EVENT_TABS);
  // The event being edited is kept in the address (?event=<id> or
  // ?event=new), so the browser's Back returns to the week and a reload
  // stays on the form.
  const [params, setParams] = useSearchParams();
  const editingKey = params.get('event');

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

  // Opened from the address alone (a reload, Back/Forward): fill the
  // draft once the events are in.
  useEffect(() => {
    if (!editingKey || editingKey === draftFor) return;
    if (editingKey === 'new') {
      setDraft(EMPTY_DRAFT);
      setDraftFor('new');
      return;
    }
    if (!items) return;
    const item = items.find((e) => e.id === editingKey);
    if (item) {
      setDraft(draftFrom(item));
      setDraftFor(item.id);
    } else closeEditor();
  }, [editingKey, items]);

  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(intlLocale(language), { hour: '2-digit', minute: '2-digit' });
  const sortByStart = (list: Event[]) => list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  function setEditingKey(key: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key) next.set('event', key);
        else next.delete('event');
        return next;
      },
      { replace: key === null },
    );
    window.scrollTo(0, 0);
  }

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setDraftFor('new');
    setFormError(null);
    setEditingKey('new');
  }

  function openEdit(item: Event) {
    setDraft(draftFrom(item));
    setDraftFor(item.id);
    setFormError(null);
    setEditingKey(item.id);
  }

  function closeEditor() {
    setDraftFor(null);
    setEditingKey(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!editingKey || !canSave(draft)) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const input = inputFrom(draft);
      if (editingKey !== 'new') {
        const id = editingKey;
        const updated = await updateEvent(poiId, id, input);
        setItems((current) => (current ? sortByStart(current.map((e) => (e.id === id ? updated : e))) : null));
      } else {
        const created = await createEvent(poiId, {
          ...input,
          location: input.location || undefined,
          description: input.description || undefined,
        });
        setItems((current) => sortByStart([...(current ?? []), created]));
        // Land on the tab where the new event is listed.
        setTab(created.recurrence !== 'none' ? 'regular' : 'upcoming');
      }
      closeEditor();
    } catch {
      setFormError(editingKey !== 'new' ? t('events.saveError') : t('events.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  const undo = useUndo();

  function handleDelete(id: string) {
    if (editingKey === id) closeEditor();
    undo.deleteLater({
      name: items?.find((e) => e.id === id)?.title,
      hide: () => hideFromList(setItems, id),
      commit: () => deleteEvent(poiId, id),
      onError: () => setError(t('events.deleteError')),
    });
  }

  // "from 1 December · until 30 June · except 12 October", the parts of
  // the full line a day's column does not already say.
  function extrasOf(item: Event): string {
    const dateOf = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long' });
    const exceptions = item.exceptions ?? [];
    return [
      new Date(item.startsAt) > new Date() ? t('events.fromDate', { date: dateOf(item.startsAt) }) : null,
      item.repeatUntil ? t('events.untilDate', { date: dateOf(item.repeatUntil) }) : null,
      exceptions.length
        ? t('events.exceptDates', {
            dates: exceptions.map((e) => exceptionDay(e.date, language).replace(/^\S+\s/, '')).join(', '),
          })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function weekEvent(item: Event, key: string) {
    const end = item.endsAt ? ` – ${timeOf(item.endsAt)}` : '';
    const extras = extrasOf(item);
    return (
      <button key={key} type="button" className="week-event" title={whenLine(item, t, language)} onClick={() => openEdit(item)}>
        <span>
          <span className="week-event-time">
            {timeOf(item.startsAt)}
            {end}
          </span>
          <span className="week-event-title">{item.title}</span>
          {extras && <span className="week-event-meta">{extras}</span>}
        </span>
      </button>
    );
  }

  function renderItem(item: Event) {
    return (
      <div key={item.id} className="card">
        <p className="card-title">{item.title}</p>
        {item.category !== 'other' && <span className="badge">{categoryName(item.category, t)}</span>}
        <p className="card-meta">{whenLine(item, t, language)}</p>
        {item.description && <p>{item.description}</p>}
        <div className="card-actions">
          <button type="button" className="btn" onClick={() => openEdit(item)}>
            {t('events.edit')}
          </button>
          <DestructiveButton label={t('events.delete')} onConfirm={() => handleDelete(item.id)} />
        </div>
      </div>
    );
  }

  // ---------- The form, on its own page ----------
  if (editingKey) {
    const isNew = editingKey === 'new';
    const preview = previewOf(draft);
    const previewDays =
      preview && preview.recurrence === 'weekly' ? ALL_DAYS.filter((day) => weekdaysOf(preview).includes(day)) : [];
    const previewTime = preview ? `${timeOf(preview.startsAt)}${preview.endsAt ? ` – ${timeOf(preview.endsAt)}` : ''}` : '';
    return (
      <div>
        <button type="button" className="link-button back-link" onClick={closeEditor}>
          {t('events.allEvents')}
        </button>
        <h2>{isNew ? t('tabs.newEvent').replace(/^\+\s*/, '') : draft.title || t('events.edit')}</h2>
        {draftFor !== editingKey ? (
          <p className="muted">{t('events.loading')}</p>
        ) : (
          <div className="event-editor">
            <form className="form card" onSubmit={handleSave}>
              <EventFields isChurch={isChurch} draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
              <div className="card-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting || !canSave(draft)}>
                  {!isNew ? t('events.save') : submitting ? t('events.scheduling') : t('events.schedule')}
                </button>
                <button type="button" className="btn" onClick={closeEditor}>
                  {t('events.cancel')}
                </button>
                {!isNew && (
                  <span className="card-actions-end">
                    <DestructiveButton label={t('events.delete')} onConfirm={() => handleDelete(editingKey)} />
                  </span>
                )}
              </div>
              {formError && <p className="error-text">{formError}</p>}
            </form>
            <aside className="card event-preview" aria-live="polite">
              <h3 className="event-preview-heading">{t('events.previewHeading')}</h3>
              <p className="muted event-preview-hint">{t('events.previewHint')}</p>
              {preview && (
                <>
                  {previewDays.map((day) => (
                    <div key={day} className="event-preview-row">
                      <b>{capitalise(weekdayName(day, language, 'short'))}</b>
                      <span>
                        {previewTime} {draft.title}
                      </span>
                    </div>
                  ))}
                  <p className="event-summary">{whenLine(preview, t, language)}</p>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    );
  }

  const repeating = items?.filter((e) => e.recurrence !== 'none') ?? [];
  // Each day of the week, Monday first, with its weekly events by time.
  const week = ALL_DAYS.map((day) => ({
    day,
    events: repeating
      .filter((e) => e.recurrence === 'weekly' && weekdaysOf(e).includes(day))
      .sort((a, b) => minuteOfDay(a.startsAt) - minuteOfDay(b.startsAt)),
  }));
  // Monthly ones in their own card below: the nth weekday ones in the
  // order of the month, then those on a date.
  const monthOrder = (e: Event) =>
    e.monthlyDay ? 100 + e.monthlyDay : ((e.monthlyWeek ?? 1) === -1 ? 5 : (e.monthlyWeek ?? 1)) * 10 + (((e.monthlyWeekday ?? 0) + 6) % 7);
  const monthly = repeating.filter((e) => e.recurrence === 'monthly').sort((a, b) => monthOrder(a) - monthOrder(b));
  const now = new Date().toISOString();
  const once = items?.filter((e) => e.recurrence === 'none') ?? [];
  const upcoming = once.filter((e) => (e.endsAt ?? e.startsAt) >= now);
  const past = once.filter((e) => (e.endsAt ?? e.startsAt) < now).reverse();

  return (
    <div>
      <h2>{t('events.title')}</h2>
      <p className="muted">{t('events.subtitle')}</p>
      <div className="page-action">
        <button type="button" className="btn btn-primary" onClick={openNew}>
          {t('tabs.newEvent')}
        </button>
      </div>

      <TabBar
        idPrefix="events"
        label={t('tabs.label')}
        current={tab}
        onChange={setTab}
        tabs={[
          { key: 'regular', label: t('tabs.eventsRegular'), count: items ? repeating.length : null },
          { key: 'upcoming', label: t('tabs.eventsUpcoming'), count: items ? upcoming.length : null },
          { key: 'past', label: t('tabs.eventsPast') },
        ]}
      />

      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <p className="muted">{t('events.loading')}</p>}

      <TabPanel idPrefix="events" tabKey="regular" current={tab}>
        <p className="muted" style={{ marginTop: 0 }}>{t('events.weeklyHint')}</p>
        {items && (
          <div className="card week-card">
            {week.map(({ day, events }) => (
              <section key={day} className="week-col" aria-label={weekdayName(day, language)}>
                <h3 className="week-day-name">{capitalise(weekdayName(day, language, 'short'))}</h3>
                {events.map((item) => weekEvent(item, `${item.id}-${day}`))}
              </section>
            ))}
          </div>
        )}
        {monthly.length > 0 && (
          <section className="card week-monthly">
            <h3 className="week-monthly-heading">{t('events.notEveryWeek')}</h3>
            <p className="muted week-monthly-hint">{t('events.notEveryWeekHint')}</p>
            {monthly.map((item) => (
              <button key={item.id} type="button" className="month-row" onClick={() => openEdit(item)}>
                <span className="month-row-when">{repeatPhrase(item, t, language)}</span>
                <span className="month-row-what">
                  <b>{item.title}</b>
                  {[`${timeOf(item.startsAt)}${item.endsAt ? ` – ${timeOf(item.endsAt)}` : ''}`, item.location, extrasOf(item) || null]
                    .filter(Boolean)
                    .map((part) => ` · ${part}`)
                    .join('')}
                </span>
              </button>
            ))}
          </section>
        )}
      </TabPanel>

      <TabPanel idPrefix="events" tabKey="upcoming" current={tab}>
        {items && upcoming.length === 0 && <p className="muted">{t('tabs.eventsNoUpcoming')}</p>}
        <div className="card-grid">{upcoming.map(renderItem)}</div>
      </TabPanel>

      <TabPanel idPrefix="events" tabKey="past" current={tab}>
        {items && past.length === 0 && <p className="muted">{t('tabs.eventsNoPast')}</p>}
        <div className="card-grid">{past.map(renderItem)}</div>
      </TabPanel>
    </div>
  );
}

const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

const EVENT_TABS = ['regular', 'upcoming', 'past'] as const;

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
