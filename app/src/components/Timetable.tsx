import { Pressable, View } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { BellIcon } from './icons';
import {
  formatDays,
  timeKey,
  weekdayName,
  type MonthlyRule,
  type TimetableNote,
  type TimetableRow,
  type TimetableSection,
} from '../utils/schedule';
import type { EventCategory } from '../api/types';
import { useI18n } from '../i18n/I18nContext';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';

/**
 * One kind of celebration's weekly times, as one white card: its name on
 * top, then a line per run of days, told apart by hairlines. The days sit
 * on the left and the times on the right, the way a church door lists
 * them.
 */
export function TimetableCard({ section }: { section: TimetableSection }) {
  const { t } = useI18n();
  return (
    <View style={styles.card}>
      <AccessibleText variant="bodyLarge" style={styles.heading}>
        {t(`schedule.category_${section.category}`)}
      </AccessibleText>
      <TimetableRows rows={section.rows} notes={section.notes} />
    </View>
  );
}

/**
 * Reminders on the compact timetable: a bell beside each kind's name,
 * coral once any of its times has one, and a small bell on those times.
 */
export type TimetableBells = {
  isSectionOn: (category: EventCategory) => boolean;
  onSectionBell: (category: EventCategory) => void;
  isTimeOn: (category: EventCategory, row: TimetableRow, time: string) => boolean;
};

/**
 * The whole weekly timetable in one white card, kept tight: each kind of
 * celebration a small heading over its lines, the kinds split by a
 * hairline. For the Events page, where the week has to fit on a screen.
 */
export function CompactTimetable({ sections, bells }: { sections: TimetableSection[]; bells?: TimetableBells }) {
  const { t } = useI18n();
  return (
    <View style={styles.compactCard}>
      {sections.map((section, index) => {
        const name = t(`schedule.category_${section.category}`);
        const on = bells?.isSectionOn(section.category) ?? false;
        return (
          <View key={section.category} style={[styles.group, index > 0 && styles.groupDivider]}>
            <View style={styles.headingRow}>
              <AccessibleText variant="body" style={[styles.heading, bells && styles.headingWithBell]}>
                {name}
              </AccessibleText>
              {bells && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('reminders.sectionBell', { title: name })}
                  accessibilityState={{ checked: on }}
                  onPress={() => bells.onSectionBell(section.category)}
                  hitSlop={8}
                  style={[styles.bellButton, on && styles.bellButtonActive]}
                >
                  <BellIcon size={16} color={on ? '#FFFFFF' : colors.textMuted} filled={on} />
                </Pressable>
              )}
            </View>
            <TimetableRows
              rows={section.rows}
              notes={section.notes}
              compact
              isTimeOn={bells ? (row, time) => bells.isTimeOn(section.category, row, time) : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}

const NTH_KEYS: Record<string, 'schedule.nth_1' | 'schedule.nth_2' | 'schedule.nth_3' | 'schedule.nth_4' | 'schedule.nth_last'> = {
  '1': 'schedule.nth_1',
  '2': 'schedule.nth_2',
  '3': 'schedule.nth_3',
  '4': 'schedule.nth_4',
  '-1': 'schedule.nth_last',
};

const DATE_LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', va: 'ca-ES', ca: 'ca-ES', gl: 'gl-ES', pt: 'pt-PT', fr: 'fr-FR' };

/** A monthly line's rule in words: "First Friday of the month", "On the 15th". */
export function monthlyRuleLabel(
  rule: MonthlyRule,
  t: ReturnType<typeof useI18n>['t'],
  language: string,
): string {
  const text =
    rule.day != null
      ? t('schedule.monthlyDay', { day: rule.day })
      : t('schedule.monthlyNth', {
          nth: t(NTH_KEYS[String(rule.week)] ?? 'schedule.nth_1'),
          weekday: weekdayName(rule.weekday ?? 0, language),
        });
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/**
 * The lines of a timetable, for a card that brings its own heading, then
 * the days off coming up: "Not on Wednesday 11 November at 08:30".
 */
export function TimetableRows({
  rows,
  notes = [],
  compact = false,
  isTimeOn,
}: {
  rows: TimetableRow[];
  notes?: TimetableNote[];
  compact?: boolean;
  // Times with a reminder get a small bell before them.
  isTimeOn?: (row: TimetableRow, time: string) => boolean;
}) {
  const { t, language } = useI18n();
  const monthlyLabel = (rule: MonthlyRule) => monthlyRuleLabel(rule, t, language);
  return (
    <>
      {rows.map((row) => {
        const days = row.monthly ? monthlyLabel(row.monthly) : formatDays(row.days, language);
        const times = row.times.join(' · ');
        return (
          <View
            key={days}
            style={compact ? styles.compactRow : styles.row}
            accessible
            accessibilityLabel={`${days}: ${row.times.join(', ')}`}
          >
            <AccessibleText variant="body" style={styles.days}>
              {days}
            </AccessibleText>
            {isTimeOn && row.times.some((time) => isTimeOn(row, time)) ? (
              <View style={styles.timeList}>
                {row.times.map((time, i) => {
                  const on = isTimeOn(row, time);
                  return (
                    <View key={time} style={styles.timeItem}>
                      {on && <BellIcon size={13} color={colors.primaryStrong} filled />}
                      <AccessibleText
                        variant="body"
                        color={on ? colors.primaryStrong : undefined}
                        style={styles.times}
                      >
                        {i < row.times.length - 1 ? `${time} ·` : time}
                      </AccessibleText>
                    </View>
                  );
                })}
              </View>
            ) : (
              <AccessibleText variant="body" style={styles.times}>
                {times}
              </AccessibleText>
            )}
          </View>
        );
      })}
      {notes.map((note) => {
        const date = note.startsAt.toLocaleDateString(DATE_LOCALES[language] ?? language, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        const values = { date, time: timeKey(note.startsAt), reason: note.reason ?? '' };
        return (
          <AccessibleText
            key={note.startsAt.toISOString()}
            variant="body"
            color={colors.primaryStrong}
            style={styles.note}
          >
            {t(note.reason ? 'schedule.dayOffReason' : 'schedule.dayOff', values)}
          </AccessibleText>
        );
      })}
    </>
  );
}

const styles = themedStyles(() => ({
  card: {
    ...cardSurface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  heading: {
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingWithBell: {
    flex: 1,
    marginBottom: 0,
  },
  // The same round bell as a one-off event's, a size down to suit the
  // compact card; hitSlop keeps the target finger-sized.
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    ...cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellButtonActive: {
    backgroundColor: colors.primary,
  },
  timeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  compactCard: {
    ...cardSurface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
  },
  group: {
    paddingVertical: spacing.sm,
  },
  groupDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  days: {
    flexShrink: 1,
  },
  note: {
    fontWeight: '700',
    paddingVertical: spacing.xs,
  },
  times: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
}));
