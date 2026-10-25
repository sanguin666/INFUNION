import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import {
  CalendarIcon,
  CandleIcon,
  ChaliceIcon,
  BookIcon,
  EnvelopeIcon,
  ChatBubbleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardIcon,
  ContrastIcon,
  ExitIcon,
  BellIcon,
  GlobeIcon,
  HeartIcon,
  MegaphoneIcon,
  PinIcon,
  PlayIcon,
  PlusIcon,
} from '../components/icons';
import { hubMenu, type HubTab } from '../components/PoiShell';
import type { ActiveModule, ModuleType, Poi } from '../api/types';
import { cardSurface, colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import { getPoiTheme } from '../theme/poiThemes';
import { useI18n } from '../i18n/I18nContext';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import { getNotificationPreferences } from '../api/notifications';
import { getPermissionState } from '../notifications/push';
import { useAuth } from '../auth/AuthContext';
import { useAppearance, type AppearancePreference } from '../theme/AppearanceContext';

/**
 * Each language written in itself, never translated. Somebody who opened
 * the app in a language they cannot read is exactly who this list is for,
 * and "Spanish" is no help to them where "Español" is.
 */
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  va: 'Valencià',
  gl: 'Galego',
  pt: 'Português',
  fr: 'Français',
};

const APPEARANCES: AppearancePreference[] = ['auto', 'light', 'dark'];

function appearanceLabel(preference: AppearancePreference, t: ReturnType<typeof useI18n>['t']): string {
  switch (preference) {
    case 'auto':
      return t('more.appearanceAuto');
    case 'light':
      return t('more.appearanceLight');
    case 'dark':
      return t('more.appearanceDark');
  }
}

type Props = {
  poi: Poi;
  modules: ActiveModule[] | null;
  onSelectTab: (tab: HubTab) => void;
  onOpenPlaces: () => void;
  onAddPlace: () => void;
  onOpenNotifications: () => void;
  // Resolves once the membership is gone and the app has moved on, so
  // this screen knows when to stop showing its spinner.
  onLeavePlace: () => Promise<void>;
};

/**
 * What the bottom menu had no room for: the place's remaining modules
 * first, then the app's own settings under a divider. A full screen
 * rather than a sheet to drag up, and every row is a full-width target
 * with its name spelled out — the tab bar's labels are short by
 * necessity, this list has no such excuse.
 */
export function MoreScreen({
  poi,
  modules,
  onSelectTab,
  onOpenPlaces,
  onAddPlace,
  onLeavePlace,
  onOpenNotifications,
}: Props) {
  const { t, language, setLanguage } = useI18n();
  const insets = useSafeAreaInsets();
  const poiTheme = getPoiTheme(poi.type);
  const [languageOpen, setLanguageOpen] = useState(false);
  const { preference, setPreference } = useAppearance();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveFailed, setLeaveFailed] = useState(false);
  const { me } = useAuth();
  // "On" when this phone may show notifications and at least one kind is
  // on for this place; null until known, so the row never says the wrong
  // thing first.
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    Promise.all([getPermissionState(), getNotificationPreferences(poi.id)])
      .then(([permission, preferences]) => {
        if (cancelled) return;
        setNotificationsOn(permission === 'granted' && Object.values(preferences).some(Boolean));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [poi.id, me?.id]);

  async function leave() {
    setLeaving(true);
    setLeaveFailed(false);
    try {
      await onLeavePlace();
      setConfirmingLeave(false);
    } catch {
      setLeaveFailed(true);
    } finally {
      setLeaving(false);
    }
  }

  const rows = hubMenu(poi, modules).inMore.map((type) => ({
    type,
    icon: moduleIcon(type),
    label: moduleLabel(type, t),
  }));

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('more.title')}</AccessibleText>
      </View>

      {rows.map((row) => (
        <Pressable
          key={row.type}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          onPress={() => onSelectTab(row.type)}
          style={styles.row}
        >
          {row.icon(poiTheme.accentStrong)}
          <AccessibleText variant="bodyLarge" style={styles.rowLabel} {...ONE_LINE}>
            {row.label}
          </AccessibleText>
          <ChevronRightIcon size={22} color={colors.textMuted} />
        </Pressable>
      ))}

      {/* The line separates the modules from the place actions, so it
          only appears when there are modules above it. */}
      {rows.length > 0 && <View style={styles.divider} />}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('hub.switchPlace')}
        onPress={onOpenPlaces}
        style={styles.row}
      >
        <PinIcon size={26} color={colors.textMuted} />
        <AccessibleText variant="bodyLarge" style={styles.rowLabel} {...ONE_LINE}>
          {t('hub.switchPlace')}
        </AccessibleText>
        <ChevronRightIcon size={22} color={colors.textMuted} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('places.addPlace')}
        onPress={onAddPlace}
        style={styles.row}
      >
        <PlusIcon size={26} color={colors.textMuted} />
        <AccessibleText variant="bodyLarge" style={styles.rowLabel} {...ONE_LINE}>
          {t('places.addPlace')}
        </AccessibleText>
        <ChevronRightIcon size={22} color={colors.textMuted} />
      </Pressable>

      {/* Last of the three, and the only one that undoes something, so it
          is the one that asks before acting. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('more.leavePlace')}
        onPress={() => {
          setLeaveFailed(false);
          setConfirmingLeave(true);
        }}
        style={[styles.row, styles.rowDestructive]}
      >
        <ExitIcon size={26} color={colors.danger} />
        <AccessibleText variant="bodyLarge" color={colors.danger} style={styles.rowLabel} {...ONE_LINE}>
          {t('more.leavePlace')}
        </AccessibleText>
      </Pressable>

      <Modal
        visible={confirmingLeave}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmingLeave(false)}
      >
        <Pressable
          style={styles.scrim}
          accessibilityLabel={t('more.leaveCancel')}
          onPress={() => !leaving && setConfirmingLeave(false)}
        />
        <View style={[styles.confirmSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <AccessibleText variant="title">
            {t('more.leaveQuestion', { poiName: poi.name })}
          </AccessibleText>
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('more.leaveExplainer')}
          </AccessibleText>

          {leaveFailed && (
            <AccessibleText variant="body" color={colors.danger}>
              {t('more.leaveError')}
            </AccessibleText>
          )}

          {leaving ? (
            <View style={styles.leavingRow}>
              <ActivityIndicator color={colors.primaryStrong} size="large" />
            </View>
          ) : (
            <>
              {/* The act is the orange button every other screen uses
                  for its call to action; what the button says is what
                  makes it serious, not a colour of its own. */}
              <AccessibleButton
                label={t('more.leaveConfirm')}
                onPress={() => void leave()}
              />
              <AccessibleButton
                label={t('more.leaveCancel')}
                variant="secondary"
                onPress={() => setConfirmingLeave(false)}
              />
            </>
          )}
        </View>
      </Modal>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          notificationsOn === null
            ? t('notifications.title')
            : `${t('notifications.title')}: ${notificationsOn ? t('notifications.on') : t('notifications.off')}`
        }
        onPress={onOpenNotifications}
        style={styles.row}
      >
        <BellIcon size={26} color={colors.textMuted} />
        <AccessibleText variant="bodyLarge" style={styles.rowLabelBesideValue} numberOfLines={1}>
          {t('notifications.title')}
        </AccessibleText>
        {notificationsOn !== null && (
          <AccessibleText variant="body" color={colors.textMuted} style={styles.rowValue} numberOfLines={1}>
            {notificationsOn ? t('notifications.on') : t('notifications.off')}
          </AccessibleText>
        )}
        <ChevronRightIcon size={22} color={colors.textMuted} />
      </Pressable>

      {/* One row carrying the language it is currently set to, rather
          than three abbreviations side by side. The list itself only
          appears once somebody asks for it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('home.languageLabel')}: ${LANGUAGE_NAMES[language]}`}
        onPress={() => setLanguageOpen(true)}
        style={styles.row}
      >
        <GlobeIcon size={26} color={colors.textMuted} />
        <AccessibleText variant="bodyLarge" style={styles.rowLabelBesideValue} numberOfLines={1}>
          {t('home.languageLabel')}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted} style={styles.rowValue} numberOfLines={1}>
          {LANGUAGE_NAMES[language]}
        </AccessibleText>
        <ChevronRightIcon size={22} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={languageOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageOpen(false)}
      >
        <Pressable
          style={styles.scrim}
          accessibilityLabel={t('places.close')}
          onPress={() => setLanguageOpen(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <AccessibleText variant="title">{t('more.chooseLanguage')}</AccessibleText>

          {SUPPORTED_LANGUAGES.map((code, index) => {
            const selected = code === language;
            const last = index === SUPPORTED_LANGUAGES.length - 1;
            return (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={LANGUAGE_NAMES[code]}
                onPress={() => {
                  setLanguage(code);
                  setLanguageOpen(false);
                }}
                style={[
                  styles.languageOption,
                  selected && styles.languageOptionSelected,
                  // A line under the last one would separate it from the
                  // Close button, which is not one of the choices.
                  last && styles.languageOptionLast,
                ]}
              >
                <AccessibleText
                  variant="bodyLarge"
                  color={selected ? colors.primaryStrong : colors.text}
                  style={styles.rowLabel}
                >
                  {LANGUAGE_NAMES[code]}
                </AccessibleText>
                {/* A tick as well as the colour, so the choice is not
                    carried by colour alone. */}
                {selected && <CheckIcon size={24} color={colors.primaryStrong} />}
              </Pressable>
            );
          })}

          <AccessibleButton
            label={t('places.close')}
            variant="secondary"
            onPress={() => setLanguageOpen(false)}
          />
        </View>
      </Modal>

      {/* Light or dark, set the same way as the language: one row saying
          what it is set to, and the choice in a sheet. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('more.appearance')}: ${appearanceLabel(preference, t)}`}
        onPress={() => setAppearanceOpen(true)}
        style={styles.row}
      >
        <ContrastIcon size={26} color={colors.textMuted} />
        <AccessibleText variant="bodyLarge" style={styles.rowLabelBesideValue} numberOfLines={1}>
          {t('more.appearance')}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted} style={styles.rowValue} numberOfLines={1}>
          {appearanceLabel(preference, t)}
        </AccessibleText>
        <ChevronRightIcon size={22} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={appearanceOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAppearanceOpen(false)}
      >
        <Pressable
          style={styles.scrim}
          accessibilityLabel={t('places.close')}
          onPress={() => setAppearanceOpen(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <AccessibleText variant="title">{t('more.appearance')}</AccessibleText>
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('more.appearanceExplainer')}
          </AccessibleText>

          {APPEARANCES.map((option, index) => {
            const selected = option === preference;
            const last = index === APPEARANCES.length - 1;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={appearanceLabel(option, t)}
                // The sheet stays open, so the switch is seen happening
                // around it and can be taken back at once.
                onPress={() => setPreference(option)}
                style={[styles.languageOption, last && styles.languageOptionLast]}
              >
                <AccessibleText
                  variant="bodyLarge"
                  color={selected ? colors.primaryStrong : colors.text}
                  style={styles.rowLabel}
                >
                  {appearanceLabel(option, t)}
                </AccessibleText>
                {selected && <CheckIcon size={24} color={colors.primaryStrong} />}
              </Pressable>
            );
          })}

          <AccessibleButton
            label={t('places.close')}
            variant="secondary"
            onPress={() => setAppearanceOpen(false)}
          />
        </View>
      </Modal>
    </>
  );
}

// The list has room the tab bar's labels never do, so the modules are
// named in full here.
function moduleLabel(type: ModuleType, t: ReturnType<typeof useI18n>['t']): string {
  switch (type) {
    case 'prayer_requests':
      return t('more.prayerRequests');
    case 'community':
      return t('more.community');
    case 'livestreams':
      return t('livestream.title');
    case 'events':
      return t('events.title');
    case 'announcements':
      return t('announcements.title');
    case 'donations':
      return t('hub.donationsLabel');
    case 'requests':
      return t('requests.title');
    case 'mass_intentions':
      return t('intentions.title');
    case 'daily_readings':
      return t('readings.title');
    case 'messages':
      return t('messages.title');
  }
}

function moduleIcon(type: ModuleType): (color: string) => ReactNode {
  switch (type) {
    case 'prayer_requests':
      return (color) => <CandleIcon size={26} color={color} />;
    case 'community':
      return (color) => <ChatBubbleIcon size={26} color={color} />;
    case 'livestreams':
      return (color) => <PlayIcon size={26} color={color} />;
    case 'events':
      return (color) => <CalendarIcon size={26} color={color} />;
    case 'announcements':
      return (color) => <MegaphoneIcon size={26} color={color} />;
    case 'donations':
      return (color) => <HeartIcon size={26} color={color} />;
    case 'requests':
      return (color) => <ClipboardIcon size={26} color={color} />;
    case 'mass_intentions':
      return (color) => <ChaliceIcon size={26} color={color} />;
    case 'daily_readings':
      return (color) => <BookIcon size={26} color={color} />;
    case 'messages':
      return (color) => <EnvelopeIcon size={26} color={color} />;
  }
}

// Every More row stays on one line: a label too long for the row gets
// smaller type rather than a second line.
const ONE_LINE = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 } as const;

const styles = themedStyles(() => ({
  titleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 14,
    paddingHorizontal: spacing.md,
    ...cardSurface,
    borderRadius: radii.lg,
  },
  // The one row that destroys something wears the same heavy edge as the
  // Sign out button, so it never reads as one more place to tap through.
  rowDestructive: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontWeight: '700',
  },
  // Beside a value, the label keeps its own width and the value takes
  // what is left, so "Activadas" ends in "…" before the label does. No
  // font fitting here: Android measured a fitted label of free width as
  // zero and hid it.
  rowLabelBesideValue: {
    flexShrink: 0,
    fontWeight: '700',
  },
  rowValue: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.primary,
    marginVertical: spacing.xs,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  // On the white sheet, so the options are rows told apart by a hairline
  // rather than boxes: the one in use is named by its colour and its
  // tick, not by a frame around it.
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  languageOptionSelected: {},
  languageOptionLast: {
    borderBottomWidth: 0,
  },
  confirmSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  leavingRow: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
