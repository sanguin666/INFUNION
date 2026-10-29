import { Fragment, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccessibleText } from '../components/AccessibleText';
import { BellIcon, CalendarIcon, ChevronRightIcon, PlayIcon } from '../components/icons';
import { CompactTimetable, type TimetableBells } from '../components/Timetable';
import { TimesReminderSheet } from '../components/ReminderSheets';
import { groupByDay, SummaryDay, SummaryList, SummaryRow } from '../components/SummaryList';
import { getEvents } from '../api/events';
import { useEventReminders } from '../notifications/useEventReminders';
import { useAuth } from '../auth/AuthContext';
import {
  regularEvents,
  repeats,
  occurrencesOf,
  rowHasEvent,
  timeKey,
  timetableTime,
  weeklyTimetable,
} from '../utils/schedule';
import { useI18n } from '../i18n/I18nContext';
import { colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import { type Event, type EventCategory, type Poi, sendsNotifications } from '../api/types';

type Props = {
  poi: Poi;
  // Set only where the place also streams: the livestream has no button
  // of its own in the bottom menu, it sits at the top of this screen.
  onWatchLive?: () => void;
  // Opens the week as a calendar, one day at a time.
  onOpenCalendar?: () => void;
};

export function EventsScreen({ poi, onWatchLive, onOpenCalendar }: Props) {
  const { t } = useI18n();
  const { me } = useAuth();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState(false);
  // The bells the reader rang: a push an hour before, sent by the backend.
  const reminders = useEventReminders(poi.id);
  // The kind whose times are open in the reminders sheet.
  const [bellCategory, setBellCategory] = useState<EventCategory | null>(null);

  useEffect(() => {
    getEvents(poi.id)
      .then(setEvents)
      .catch(() => setError(true));
  }, [poi.id]);

  // The weekly timetable first, since it is what most people come for;
  // then the one-off events still to come, soonest first.
  const now = new Date();
  const timetable = weeklyTimetable(events ?? [], now);
  const oneOffs = (events ?? []).filter((event) => !repeats(event) && occurrencesOf(event, now, 1).length > 0);
  const regular = regularEvents(events ?? [], now);
  const ofCategory = (category: EventCategory) => regular.filter((event) => event.category === category);

  // Signed-in readers only: a bell needs someone to remind, and a place
  // whose plan sends notifications.
  const canBell = !!me && sendsNotifications(poi);
  const bells: TimetableBells | undefined = canBell
    ? {
        isSectionOn: (category) => ofCategory(category).some((event) => reminders.isEveryTime(event.id)),
        onSectionBell: setBellCategory,
        isTimeOn: (category, row, time) =>
          ofCategory(category).some(
            (event) => reminders.isEveryTime(event.id) && timetableTime(event) === time && rowHasEvent(row, event),
          ),
      }
    : undefined;

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('events.title')}</AccessibleText>
      </View>

      {onOpenCalendar && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('events.openCalendar')}. ${t('events.openCalendarHint')}`}
          onPress={onOpenCalendar}
          style={styles.calendarCard}
        >
          <View style={styles.calendarIcon}>
            <CalendarIcon size={30} color={colors.primaryStrong} />
          </View>
          <View style={styles.liveText}>
            <AccessibleText variant="bodyLarge" color="#FFFFFF" style={styles.liveTitle}>
              {t('events.openCalendar')}
            </AccessibleText>
            {/* White on this orange only clears contrast as large bold text. */}
            <AccessibleText variant="body" color="#FFFFFF" style={styles.calendarHint}>
              {t('events.openCalendarHint')}
            </AccessibleText>
          </View>
          <ChevronRightIcon size={22} color="#FFFFFF" />
        </Pressable>
      )}

      {onWatchLive && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('events.watchLive')}
          onPress={onWatchLive}
          style={styles.liveCard}
        >
          <View style={styles.liveIcon}>
            <PlayIcon size={28} color={colors.primaryStrong} />
          </View>
          <View style={styles.liveText}>
            <AccessibleText variant="bodyLarge" color="#FFFFFF" style={styles.liveTitle}>
              {t('events.watchLive')}
            </AccessibleText>
            <AccessibleText variant="caption" color="rgba(255,255,255,0.9)">
              {t('events.watchLiveHint')}
            </AccessibleText>
          </View>
          <ChevronRightIcon size={22} color="#FFFFFF" />
        </Pressable>
      )}

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

      {!error && events !== null && timetable.length === 0 && oneOffs.length === 0 && (
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('events.empty')}
        </AccessibleText>
      )}

      {timetable.length > 0 && <CompactTimetable sections={timetable} bells={bells} />}

      <TimesReminderSheet
        title={bellCategory ? t(`schedule.category_${bellCategory}`) : null}
        events={bellCategory ? ofCategory(bellCategory) : []}
        isOn={reminders.isEveryTime}
        onToggle={(eventId, on) => void reminders.set(eventId, on ? null : undefined)}
        onClose={() => setBellCategory(null)}
      />

      {timetable.length > 0 && oneOffs.length > 0 && (
        <AccessibleText variant="caption" style={styles.sectionLabel}>
          {t('schedule.comingUp')}
        </AccessibleText>
      )}
      {oneOffs.length > 0 && (
        <SummaryList>
          {groupByDay(oneOffs, (event) => new Date(event.startsAt)).map((day, dayIndex) => (
            <Fragment key={day.date.toDateString()}>
              <SummaryDay date={day.date} first={dayIndex === 0} />
              {day.items.map((event) => {
                const time = timeKey(new Date(event.startsAt));
                const isNotifying = reminders.isOn(event.id);
                return (
                  <SummaryRow
                    key={event.id}
                    lead={time}
                    title={event.title}
                    detail={event.location}
                    accessibilityLabel={[event.title, time, event.location].filter(Boolean).join(', ')}
                    accessory={
                      canBell && <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isNotifying
                            ? t('events.notifyOn', { title: event.title })
                            : t('events.notifyOff', { title: event.title })
                        }
                        onPress={() => void reminders.set(event.id, isNotifying ? undefined : null)}
                        hitSlop={8}
                        style={styles.bellButton}
                      >
                        <BellIcon
                          size={22}
                          color={isNotifying ? colors.primary : colors.textMuted}
                          filled={isNotifying}
                        />
                      </Pressable>
                    }
                  />
                );
              })}
            </Fragment>
          ))}
        </SummaryList>
      )}
    </>
  );
}

const styles = themedStyles(() => ({
  titleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryFill,
  },
  // The same shape as the live card below it, in the orange every call to
  // action wears, so the two read as a pair of ways into the week.
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  calendarIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarHint: {
    fontWeight: '700',
  },
  liveIcon: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveText: {
    flex: 1,
    gap: 2,
  },
  liveTitle: {
    fontWeight: '800',
  },
  // Just the bell, orange and filled when on: no frame, so the row stays
  // one white box; the tap area keeps the full touch size.
  bellButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    marginRight: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
