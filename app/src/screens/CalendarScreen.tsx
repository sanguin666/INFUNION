import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccessibleText } from '../components/AccessibleText';
import { BackChevronIcon, BellIcon, ChevronRightIcon } from '../components/icons';
import { RepeatReminderSheet } from '../components/ReminderSheets';
import { getEvents } from '../api/events';
import { dayKey, occurrencesOnDay, repeats, startOfWeek, timeKey, type Occurrence } from '../utils/schedule';
import { useEventReminders } from '../notifications/useEventReminders';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { cardSurface, colors, minTouchTarget, radii, spacing, themedStyles, currentColorScheme } from '../theme/theme';
import { type Event, type EventCategory, type Poi, sendsNotifications } from '../api/types';

type Props = { poi: Poi };

const DAY_LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', va: 'ca-ES', gl: 'gl-ES', pt: 'pt-PT', fr: 'fr-FR' };

// A Mass has no end time; it counts as this many minutes long when
// working out whether it is still under way.
const DEFAULT_MINUTES = 60;

// A pale fill and a strong edge per kind, so the kinds tell apart at a
// glance while the dark text on the fill stays easy to read. In dark mode
// the fill goes dark and the edge light, so the light text still reads.
const CATEGORY_COLORS: Record<EventCategory, { fill: string; edge: string }> = {
  mass: { fill: '#FBE3D9', edge: '#B8502E' },
  confession: { fill: '#EFE6FB', edge: '#6B4EA8' },
  adoration: { fill: '#E4F1E8', edge: '#2F7A4A' },
  prayer: { fill: '#E4F1E8', edge: '#2F7A4A' },
  office_hours: { fill: '#F1ECE4', edge: '#7A6A55' },
  other: { fill: '#FDF0D5', edge: '#A86A00' },
};
const CATEGORY_COLORS_DARK: Record<EventCategory, { fill: string; edge: string }> = {
  mass: { fill: '#4A2C20', edge: '#F2916B' },
  confession: { fill: '#352A4A', edge: '#B89CF0' },
  adoration: { fill: '#22382A', edge: '#7CC897' },
  prayer: { fill: '#22382A', edge: '#7CC897' },
  office_hours: { fill: '#3A3229', edge: '#C9B79E' },
  other: { fill: '#43341A', edge: '#E8B04A' },
};

function categoryColors() {
  return currentColorScheme() === 'dark' ? CATEGORY_COLORS_DARK : CATEGORY_COLORS;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function endOf(o: Occurrence): Date {
  return o.endsAt ?? new Date(o.startsAt.getTime() + DEFAULT_MINUTES * 60_000);
}

/**
 * The week as a calendar: the seven days along the top, a dot under each
 * for every thing happening that day, and the chosen day below as a list,
 * one full-width row per event with its title and place written out in
 * full. It was an hour grid until 24 Sep 2026: side by side, overlapping
 * events cut their titles to a few letters (Seb). Each event still to
 * come has a bell for a reminder an hour before; a day with one shows a
 * bell in the week strip instead of its dots.
 */
export function CalendarScreen({ poi }: Props) {
  const { t, language } = useI18n();
  const locale = DAY_LOCALES[language] ?? language;
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const now = new Date();
  const { me } = useAuth();
  const reminders = useEventReminders(poi.id);
  // A repeating event's bell asks first: every time, or only this day.
  const [asking, setAsking] = useState<Occurrence | null>(null);

  function ring(o: Occurrence) {
    if (reminders.isOn(o.event.id, o.startsAt)) void reminders.set(o.event.id, undefined);
    else if (repeats(o.event)) setAsking(o);
    else void reminders.set(o.event.id, null);
  }

  useEffect(() => {
    getEvents(poi.id)
      .then(setEvents)
      .catch(() => setError(true));
  }, [poi.id]);

  const weekStart = startOfWeek(day);
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, items: occurrencesOnDay(events ?? [], date) };
      }),
    [events, weekStart.getTime()],
  );
  const items = week.find((d) => sameDay(d.date, day))?.items ?? [];

  // Where "now" falls: before the first event still to come today.
  const nowIndex = sameDay(now, day) ? items.findIndex((o) => endOf(o) > now) : -1;

  const time = (date: Date) => timeKey(date);
  const weekLabel = t('calendar.weekOf', {
    date: weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
  });

  return (
    <>
      <View style={styles.weekHead}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar.previousWeek')}
          onPress={() => setDay(addDays(day, -7))}
          style={styles.arrow}
        >
          <BackChevronIcon size={22} />
        </Pressable>
        <AccessibleText variant="bodyLarge" style={styles.weekLabel} accessibilityRole="header">
          {weekLabel}
        </AccessibleText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextWeek')}
          onPress={() => setDay(addDays(day, 7))}
          style={styles.arrow}
        >
          <ChevronRightIcon size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.days} accessibilityRole="tablist">
        {week.map(({ date, items: dayItems }) => {
          const selected = sameDay(date, day);
          const belled = dayItems.some((o) => o.startsAt > now && reminders.isOn(o.event.id, o.startsAt));
          const isToday = sameDay(date, now);
          const long = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <Pressable
              key={date.toISOString()}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${long}, ${
                dayItems.length ? t('calendar.itemsOnDay', { n: dayItems.length }) : t('calendar.nothing')
              }`}
              onPress={() => setDay(date)}
              style={[styles.day, selected && styles.daySelected]}
            >
              <AccessibleText
                variant="caption"
                color={selected ? '#FFFFFF' : colors.textMuted}
                style={styles.dayName}
              >
                {date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}
              </AccessibleText>
              <AccessibleText
                variant="body"
                color={selected ? '#FFFFFF' : colors.text}
                style={[styles.dayNumber, isToday && !selected && styles.today]}
              >
                {date.getDate()}
              </AccessibleText>
              <View style={styles.dots}>
                {belled ? (
                  <BellIcon size={12} color={selected ? '#FFFFFF' : colors.primaryStrong} filled />
                ) : (
                  dayItems.slice(0, 3).map((o, i) => (
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: selected ? '#FFFFFF' : colors.primaryStrong }]}
                    />
                  ))
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('events.error')}
        </AccessibleText>
      )}
      {!error && events === null && (
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('events.loading')}
        </AccessibleText>
      )}

      {events !== null && items.length === 0 && (
        <View style={styles.emptyCard}>
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('calendar.nothing')}
          </AccessibleText>
        </View>
      )}

      {events !== null && items.length > 0 && (
        <View style={styles.list}>
          {items.map((o, i) => {
            const tone = categoryColors()[o.event.category] ?? CATEGORY_COLORS.other;
            const when = o.endsAt ? `${time(o.startsAt)} – ${time(o.endsAt)}` : null;
            const details = [when, o.event.location].filter(Boolean).join(' · ');
            const past = sameDay(now, day) && endOf(o) <= now;
            const belled = reminders.isOn(o.event.id, o.startsAt);
            return (
              <View key={`${o.event.id}|${o.startsAt.toISOString()}`}>
                {i === nowIndex && <NowLine label={`${t('calendar.now')} ${time(now)}`} />}
                <View style={[styles.row, i > 0 && i !== nowIndex && styles.rowDivider, past && styles.past]}>
                  <View
                    accessible
                    accessibilityLabel={`${time(o.startsAt)}, ${o.event.title}${details ? `, ${details}` : ''}${
                      belled ? `, ${t('reminders.rowOn')}` : ''
                    }`}
                    style={styles.rowMain}
                  >
                    <AccessibleText variant="bodyLarge" style={styles.rowTime}>
                      {time(o.startsAt)}
                    </AccessibleText>
                    <View style={[styles.rowEdge, { backgroundColor: tone.edge }]} />
                    <View style={styles.rowText}>
                      <AccessibleText variant="bodyLarge" style={styles.rowTitle}>
                        {o.event.title}
                      </AccessibleText>
                      {details !== '' && (
                        <AccessibleText variant="body" color={colors.textMuted}>
                          {details}
                        </AccessibleText>
                      )}
                      {belled && (
                        <View style={styles.reminderLine}>
                          <BellIcon size={13} color={colors.primaryStrong} filled />
                          <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.reminderText}>
                            {t('reminders.rowOn')}
                          </AccessibleText>
                        </View>
                      )}
                    </View>
                  </View>
                  {me && sendsNotifications(poi) && o.startsAt > now && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        belled
                          ? t('events.notifyOn', { title: o.event.title })
                          : t('events.notifyOff', { title: o.event.title })
                      }
                      onPress={() => ring(o)}
                      hitSlop={6}
                      style={[styles.bellButton, belled && styles.bellButtonActive]}
                    >
                      <BellIcon size={18} color={belled ? '#FFFFFF' : colors.textMuted} filled={belled} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
          {sameDay(now, day) && nowIndex === -1 && (
            <NowLine label={`${t('calendar.now')} ${time(now)}`} />
          )}
        </View>
      )}

      <RepeatReminderSheet
        event={asking?.event ?? null}
        startsAt={asking?.startsAt ?? null}
        onEvery={() => {
          if (asking) void reminders.set(asking.event.id, null);
          setAsking(null);
        }}
        onOnly={() => {
          if (asking) void reminders.set(asking.event.id, dayKey(asking.startsAt));
          setAsking(null);
        }}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}

function NowLine({ label }: { label: string }) {
  return (
    <View style={styles.now} accessible accessibilityLabel={label}>
      <View style={styles.nowDot} />
      <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.nowLabel}>
        {label}
      </AccessibleText>
      <View style={styles.nowLine} />
    </View>
  );
}

const styles = themedStyles(() => ({
  weekHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
  },
  arrow: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  days: {
    flexDirection: 'row',
    gap: 4,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: minTouchTarget,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayName: {
    fontWeight: '700',
  },
  dayNumber: {
    fontWeight: '800',
  },
  today: {
    textDecorationLine: 'underline',
    textDecorationColor: colors.primary,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 12,
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyCard: {
    ...cardSurface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  list: {
    ...cardSurface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reminderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  reminderText: {
    fontWeight: '700',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    ...cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellButtonActive: {
    backgroundColor: colors.primary,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  past: {
    opacity: 0.55,
  },
  rowTime: {
    fontWeight: '800',
    minWidth: 64,
  },
  rowEdge: {
    width: 5,
    alignSelf: 'stretch',
    borderRadius: 3,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontWeight: '800',
  },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  nowLabel: {
    fontWeight: '800',
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.primary,
  },
  nowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
}));
