import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from './Screen';
import { AccessibleText } from './AccessibleText';
import { Avatar } from './Avatar';
import { PlaceMark } from './PlaceMark';
import {
  BackChevronIcon,
  CalendarIcon,
  CandleIcon,
  ChaliceIcon,
  ChatBubbleIcon,
  ChevronDownIcon,
  ClipboardIcon,
  BookIcon,
  EnvelopeIcon,
  HeartIcon,
  HomeIcon,
  LogoMark,
  MegaphoneIcon,
  MoreDotsIcon,
  PlayIcon,
} from './icons';
import type { ActiveModule, ModuleType, Poi } from '../api/types';
import type { Me } from '../api/auth';
import { colors, floatingShadow, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import { getPoiTheme } from '../theme/poiThemes';
import { useI18n } from '../i18n/I18nContext';

// Every screen the hub can show. 'home' is the place's own landing page
// and 'more' is the list of whatever the bar had no room for; the rest
// are the modules themselves.
export type HubTab = 'home' | 'more' | ModuleType;

// The bar's ceiling. Split evenly across a 390pt phone that is 78pt per
// button; a sixth would drop every button under `minTouchTarget` and
// start truncating the labels, which is what used to force the bar to
// scroll sideways.
const MAX_TABS = 5;

// Home takes the first button and More always takes the last (Seb, 23
// Sep 2026): More also carries changing, adding and leaving a place, so
// it is there even for a place whose modules all fit. That leaves three
// buttons for modules.
const BAR_SLOTS = MAX_TABS - 2;

// Where a module sits in a place that has not arranged its own menu:
// the three things people open the app for, then the two they come back
// to, and the livestream last because the events screen already offers
// it. A place reorders this in the dashboard.
const DEFAULT_MENU_ORDER: ModuleType[] = [
  'events',
  'announcements',
  'donations',
  'requests',
  'messages',
  'mass_intentions',
  'daily_readings',
  'prayer_requests',
  'community',
  'livestreams',
];

function isLive(module: ActiveModule) {
  return module.status !== 'expired' && module.status !== 'cancelled';
}

function liveModules(modules: ActiveModule[] | null): Set<ModuleType> {
  const live = new Set<ModuleType>();
  for (const module of modules ?? []) {
    if (isLive(module)) live.add(module.moduleType);
  }
  return live;
}

// Everything the place has switched on, in its own order, with anything
// it never arranged falling in behind in the default order.
function orderedLiveModules(poi: Poi, live: Set<ModuleType>): ModuleType[] {
  const chosen = (poi.menuOrder ?? []).filter((type) => live.has(type));
  const rest = DEFAULT_MENU_ORDER.filter((type) => live.has(type) && !chosen.includes(type));
  return [...chosen, ...rest];
}

// How many modules keep a button of their own: as many as fit.
function barModuleCount(total: number): number {
  return Math.min(total, BAR_SLOTS);
}

export type HubMenu = {
  // The modules with a button of their own, in bar order.
  onBar: ModuleType[];
  // The modules the More screen lists, above the place actions. May be
  // empty: the More button is there regardless.
  inMore: ModuleType[];
  // Whether the livestream is reached from the top of the events screen
  // instead of a button or a More row.
  livestreamInEvents: boolean;
};

/**
 * Who goes where in the bottom menu, from the order the place set in the
 * dashboard and the modules it currently has running.
 */
export function hubMenu(poi: Poi, modules: ActiveModule[] | null): HubMenu {
  const live = liveModules(modules);
  const ordered = orderedLiveModules(poi, live);

  // The livestream is the one module with somewhere else to live: the
  // events screen carries it at the top. A place that did not lift it
  // onto the bar gets it there rather than as one more row under More.
  const livestreamInEvents =
    live.has('livestreams') &&
    live.has('events') &&
    ordered.indexOf('livestreams') >= barModuleCount(ordered.length);

  const placed = livestreamInEvents ? ordered.filter((type) => type !== 'livestreams') : ordered;
  const onBarCount = barModuleCount(placed.length);

  return {
    onBar: placed.slice(0, onBarCount),
    inMore: placed.slice(onBarCount),
    livestreamInEvents,
  };
}

/**
 * Persistent chrome for everything under a POI: the banner on top and the
 * menu at the bottom stay mounted while `children` swaps, so neither one
 * moves or flickers when a button is pressed — only the highlight does.
 * Both clear the device's system UI via `Screen`.
 */
export function PoiShell({
  poi,
  modules,
  me,
  activeTab,
  onSelectTab,
  messagesUnread = false,
  onBack,
  onOpenPlaces,
  onOpenProfile,
  scrollKey,
  children,
}: Props) {
  const { t } = useI18n();
  const poiTheme = getPoiTheme(poi.type);

  const { onBar, inMore, livestreamInEvents } = hubMenu(poi, modules);

  const tabs: HubTab[] = ['home', ...onBar, 'more'];

  // The button that lights up for the screen showing. A screen reached
  // from somewhere other than the bar still lights the button it lives
  // under, so the bar always says where you are.
  const highlighted: HubTab = tabs.includes(activeTab)
    ? activeTab
    : activeTab === 'livestreams' && livestreamInEvents
      ? 'events'
      : 'more';

  const header = (
    <View style={styles.hero}>
      {/* A place's own logo stands where infunion's rings are elsewhere
          (Seb, 28 Oct 2026); a place without one keeps the rings (Seb,
          29 Oct 2026). */}
      {poi.logoUrl ? <PlaceMark place={poi} size={44} /> : <LogoMark size={30} />}

      {/* The name block is the switcher's target. It takes whatever width
          is left over, so the profile circle beside it never gets pushed
          off a narrow phone by a long parish name. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${poi.name}. ${t('hub.switchPlace')}`}
        onPress={onOpenPlaces}
        style={styles.heroTitleBlock}
      >
        <View style={styles.heroNameRow}>
          <AccessibleText variant="body" numberOfLines={1} style={styles.heroName}>
            {poi.name}
          </AccessibleText>
          <ChevronDownIcon size={18} color={colors.text} />
        </View>
        <AccessibleText
          variant="caption"
          color={colors.textMuted}
          numberOfLines={1}
          style={styles.heroLocation}
        >
          {poi.city ?? t('hub.locationNotSet')}
        </AccessibleText>
      </Pressable>

      {/* Only there when there is somewhere to go back to, and it takes
          no width when it is not: the place name keeps the room instead.
          The phone's own back button does the same thing (see
          PoiHubScreen), this is for the people who never use it. */}
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          style={styles.backButton}
        >
          <BackChevronIcon size={26} color={colors.text} />
        </Pressable>
      )}

      {/* Signed in or not, the circle is in the same place and opens the
          same screen — which offers signing in when there is no session,
          rather than the button quietly disappearing. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          me ? `${t('profile.title')}. ${displayName(me)}` : t('profile.openSignedOut')
        }
        onPress={onOpenProfile}
        style={styles.profileButton}
      >
        <Avatar me={me} size={48} />
      </Pressable>
    </View>
  );

  const footer = (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const { icon, label } = describe(tab, t);
        return (
          <TabBarItem
            key={tab}
            icon={icon}
            label={label}
            active={tab === highlighted}
            activeColor={poiTheme.accentStrong}
            dot={messagesUnread && (tab === 'messages' || (tab === 'more' && inMore.includes('messages')))}
            onPress={() => onSelectTab(tab)}
          />
        );
      })}
    </View>
  );

  return (
    <Screen
      scroll
      scrollKey={scrollKey}
      header={header}
      headerStyle={styles.headerSlot}
      footer={footer}
      footerStyle={styles.footerSlot}
    >
      {children}
    </Screen>
  );
}

type Props = {
  poi: Poi;
  // null while the module list is still loading.
  modules: ActiveModule[] | null;
  // The signed-in person, or null when nobody is — what the profile
  // circle draws.
  me: Me | null;
  activeTab: HubTab;
  onSelectTab: (tab: HubTab) => void;
  // A dot on Messages, or on More when Messages sits under it.
  messagesUnread?: boolean;
  // Where the banner's back chevron goes, or nothing when the screen
  // showing is the place's own home page and there is nowhere back to.
  onBack?: () => void;
  // Opens the place switcher; the banner only reports the tap so the
  // switcher's state lives with whoever owns the place list.
  onOpenPlaces: () => void;
  // Opens the settings menu behind the profile circle, on the same terms.
  onOpenProfile: () => void;
  // What is showing, so the page starts at its top when it changes.
  scrollKey?: string;
  children: ReactNode;
};

/** Whatever name someone has given, for the profile button's label. */
function displayName(me: Me): string {
  return [me.firstName, me.lastName].filter(Boolean).join(' ').trim() || (me.phone ?? me.email ?? '');
}

type Described = { icon: (color: string) => ReactNode; label: string };
type Translate = ReturnType<typeof useI18n>['t'];

function describe(tab: HubTab, t: Translate): Described {
  switch (tab) {
    case 'home':
      return { icon: (c) => <HomeIcon size={24} color={c} />, label: t('hub.homeLabel') };
    case 'events':
      return { icon: (c) => <CalendarIcon size={24} color={c} />, label: t('hub.eventsLabel') };
    case 'livestreams':
      return { icon: (c) => <PlayIcon size={24} color={c} />, label: t('hub.livestreamLabel') };
    case 'announcements':
      return { icon: (c) => <MegaphoneIcon size={24} color={c} />, label: t('hub.announcementsLabel') };
    case 'donations':
      return { icon: (c) => <HeartIcon size={24} color={c} />, label: t('hub.donationsLabel') };
    case 'prayer_requests':
      return { icon: (c) => <CandleIcon size={24} color={c} />, label: t('hub.prayerRequestsLabel') };
    case 'community':
      return { icon: (c) => <ChatBubbleIcon size={24} color={c} />, label: t('hub.communityLabel') };
    case 'requests':
      return { icon: (c) => <ClipboardIcon size={24} color={c} />, label: t('hub.requestsLabel') };
    case 'mass_intentions':
      return { icon: (c) => <ChaliceIcon size={24} color={c} />, label: t('hub.massIntentionsLabel') };
    case 'daily_readings':
      return { icon: (c) => <BookIcon size={24} color={c} />, label: t('hub.readingsLabel') };
    case 'messages':
      return { icon: (c) => <EnvelopeIcon size={24} color={c} />, label: t('hub.messagesLabel') };
    case 'more':
      return { icon: (c) => <MoreDotsIcon size={24} color={c} />, label: t('hub.moreLabel') };
  }
}

function TabBarItem({
  icon,
  label,
  active,
  activeColor,
  dot = false,
  onPress,
}: {
  icon: (color: string) => ReactNode;
  label: string;
  active: boolean;
  activeColor: string;
  dot?: boolean;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const color = active ? activeColor : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={dot ? `${label}. ${t('hub.newMessages')}` : label}
      onPress={onPress}
      style={styles.tabBarItem}
    >
      {/* Selection is the brand colour on the icon and the label, plus
          the bolder weight below — no fill behind it. */}
      <View>
        {icon(color)}
        {dot && <View style={styles.tabBarDot} />}
      </View>
      <AccessibleText variant="caption" color={color} numberOfLines={1} style={active ? styles.tabBarLabelActive : styles.tabBarLabel}>
        {label}
      </AccessibleText>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  // A plain white banner across the full width, painted behind the
  // status bar too. It sits outside the scroll view, so it stays put
  // while the page moves under it.
  headerSlot: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  hero: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroTitleBlock: {
    flex: 1,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroName: {
    fontWeight: '800',
    flexShrink: 1,
  },
  heroLocation: {
    fontWeight: '700',
  },
  backButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A 48pt circle inside a full-size target, so the picture stays a
  // picture rather than growing to fill the touch area.
  profileButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSlot: {
    backgroundColor: colors.background,
  },
  // Lifted off the bottom on all four sides. The page ends above it
  // rather than running underneath, so the last line of a screen is
  // never hidden behind a button.
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    // Clear of the bottom edge on a phone with no gesture bar to add its
    // own inset.
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    ...floatingShadow,
  },
  // Something new under this button: a small orange dot on the icon.
  tabBarDot: {
    position: 'absolute',
    top: -1,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    marginVertical: spacing.xs,
    // Kept tight so a bolded label still fits across five buttons on a
    // narrow phone rather than truncating.
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  tabBarLabel: {
    fontWeight: '500',
  },
  tabBarLabelActive: {
    fontWeight: '800',
  },
}));
