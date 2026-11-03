import { Modal, Pressable, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleButton } from './AccessibleButton';
import { AccessibleText } from './AccessibleText';
import { monthlyRuleLabel } from './Timetable';
import { formatDays, timeKey, timetableTime, weekdayName, weekdaysOf } from '../utils/schedule';
import { useI18n } from '../i18n/I18nContext';
import { colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import type { Event } from '../api/types';

const DATE_LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', va: 'ca-ES', ca: 'ca-ES', gl: 'gl-ES', pt: 'pt-PT', fr: 'fr-FR' };

// Weekdays in the order a timetable lists them: Monday first.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** When a repeating event happens, in words: "Mon–Sat 19:30", "Sunday 12:00". */
export function repeatingLabel(event: Event, t: ReturnType<typeof useI18n>['t'], language: string): string {
  const time = timetableTime(event);
  if (event.recurrence === 'monthly') {
    const rule = event.monthlyDay
      ? { week: null, weekday: null, day: event.monthlyDay }
      : { week: event.monthlyWeek ?? null, weekday: event.monthlyWeekday ?? null, day: null };
    return `${monthlyRuleLabel(rule, t, language)} ${time}`;
  }
  const days = [...weekdaysOf(event)].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
  const inARow = days.every((day, i) => i === 0 || WEEK_ORDER.indexOf(day) === WEEK_ORDER.indexOf(days[i - 1]) + 1);
  // formatDays writes three or more days as a run, so only a run goes to it.
  const written =
    days.length < 3 || inARow
      ? formatDays(days, language)
      : capitalise(days.map((day) => weekdayName(day, language, 'short')).join(', '));
  return `${written} ${time}`;
}

// Soonest in the week first, monthly ones after.
function weekPosition(event: Event): number {
  if (event.recurrence === 'monthly') return 100;
  return Math.min(...weekdaysOf(event).map((day) => WEEK_ORDER.indexOf(day)));
}

/**
 * The times of one kind of celebration (Mass), a switch each: switched on,
 * a reminder comes an hour before, every time. Opened from the bell
 * beside the kind's name in the Events tab.
 */
export function TimesReminderSheet({
  title,
  events,
  isOn,
  onToggle,
  onClose,
}: {
  // The kind's name, or null when the sheet is closed.
  title: string | null;
  events: Event[];
  isOn: (eventId: string) => boolean;
  onToggle: (eventId: string, on: boolean) => void;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const sorted = [...events].sort(
    (a, b) => weekPosition(a) - weekPosition(b) || timeKey(new Date(a.startsAt)).localeCompare(timeKey(new Date(b.startsAt))),
  );
  return (
    <Modal visible={title !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} accessibilityLabel={t('reminders.done')} onPress={onClose} />
      {/* Clear of Android's navigation buttons. */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <AccessibleText variant="title" accessibilityRole="header">
          {t('reminders.timesTitle', { title: title ?? '' })}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('reminders.timesHint')}
        </AccessibleText>
        <View>
          {sorted.map((event, index) => {
            const on = isOn(event.id);
            const label = repeatingLabel(event, t, language);
            return (
              // The whole row flips the switch, as in More › Notifications.
              <Pressable
                key={event.id}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={label}
                onPress={() => onToggle(event.id, !on)}
                style={[styles.option, index > 0 && styles.optionDivider]}
              >
                <AccessibleText variant="bodyLarge" style={styles.optionLabel}>
                  {label}
                </AccessibleText>
                <Switch
                  value={on}
                  onValueChange={(value) => onToggle(event.id, value)}
                  trackColor={{ false: colors.switchOff, true: colors.primary }}
                  thumbColor="#FFFFFF"
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                />
              </Pressable>
            );
          })}
        </View>
        <AccessibleButton label={t('reminders.done')} onPress={onClose} />
      </View>
    </Modal>
  );
}

/**
 * Ringing the bell on one time of a repeating event, from the calendar:
 * every time it happens, or only that day.
 */
export function RepeatReminderSheet({
  event,
  startsAt,
  onEvery,
  onOnly,
  onCancel,
}: {
  event: Event | null;
  startsAt: Date | null;
  onEvery: () => void;
  onOnly: () => void;
  onCancel: () => void;
}) {
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const locale = DATE_LOCALES[language] ?? language;
  const days = event ? weekdaysOf(event) : [];
  const every =
    event && event.recurrence === 'weekly' && days.length === 1
      ? t('reminders.everyWeekday', { day: weekdayName(days[0], language) })
      : t('reminders.everyTime');
  const only = startsAt
    ? t('reminders.onlyDay', {
        date: startsAt.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
      })
    : '';
  return (
    <Modal visible={event !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} accessibilityLabel={t('reminders.cancel')} onPress={onCancel} />
      {/* Clear of Android's navigation buttons. */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <AccessibleText variant="title" accessibilityRole="header">
          {event && startsAt ? t('reminders.askTitle', { title: event.title, time: timeKey(startsAt) }) : ''}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('reminders.askHint')}
        </AccessibleText>
        <AccessibleButton label={capitalise(every)} onPress={onEvery} />
        <AccessibleButton label={capitalise(only)} variant="secondary" onPress={onOnly} />
        <AccessibleButton label={t('reminders.cancel')} variant="secondary" onPress={onCancel} />
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 8,
  },
  optionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  optionLabel: {
    flex: 1,
    fontWeight: '700',
  },
}));
