import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { KindDot } from '../components/KindDot';
import { PlacesMap } from '../components/PlacesMap';
import { BackChevronIcon, ChevronRightIcon, CloseIcon } from '../components/icons';
import { geocode, getMapPlaces, type MapPlace, type Origin } from '../api/placesMap';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { PLACE_KINDS } from '../theme/placeKinds';
import { formatDistance } from '../utils/location';
import type { PoiType } from '../api/types';
import { cardSurface, colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  // Around a point, or (null) everywhere, for a search by name.
  origin: Origin | null;
  // Part of a community's name the person typed.
  query?: string;
  // Join (or open, for a member) the place picked.
  onOpenPlace: (place: MapPlace) => Promise<void>;
  // "Or search around the town …", when a name search was really a town.
  onFindNearby: (origin: Origin) => void;
  onBack: () => void;
};

type View_ = 'list' | 'map';

/**
 * "Find a community" (Seb, 18 Oct 2026): the places that put themselves on
 * the infunion map, nearest first, as a list or on a map with one colour and
 * symbol per kind of place. Tapping one shows its card, with Join.
 */
export function NearbyScreen({ origin, query, onOpenPlace, onFindNearby, onBack }: Props) {
  const { t, language } = useI18n();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<View_>('list');
  const [places, setPlaces] = useState<MapPlace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<PoiType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [townBusy, setTownBusy] = useState(false);
  const [townError, setTownError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMapPlaces(origin, query)
      .then((found) => !cancelled && setPlaces(found))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [origin?.latitude, origin?.longitude, query]);

  // Android's back closes the open card before leaving the screen.
  useEffect(() => {
    if (!selectedId) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedId(null);
      return true;
    });
    return () => subscription.remove();
  }, [selectedId]);

  // Only the kinds actually around, so no filter ever leads to nothing.
  const kinds = useMemo(
    () => PLACE_KINDS.filter((type) => places?.some((place) => place.type === type)),
    [places],
  );
  const shown = useMemo(() => (places ?? []).filter((place) => !kind || place.type === kind), [places, kind]);
  const pins = useMemo(
    () =>
      shown.flatMap(({ id, type, latitude, longitude, name }) =>
        latitude !== null && longitude !== null ? [{ id, type, latitude, longitude, name }] : [],
      ),
    [shown],
  );
  const mapOrigin = useMemo(
    () => (origin ? { latitude: origin.latitude, longitude: origin.longitude } : null),
    [origin?.latitude, origin?.longitude],
  );
  const selected = places?.find((place) => place.id === selectedId) ?? null;
  const locale = intlLocale(language);

  // The name matched nothing the person meant: look the words up as a town.
  async function searchAroundTown() {
    if (!query) return;
    setTownBusy(true);
    setTownError(null);
    try {
      const [first] = await geocode(query, language);
      if (first) {
        onFindNearby({ latitude: first.latitude, longitude: first.longitude, label: first.city ?? query });
      } else {
        setTownError(t('nearby.townNotFound'));
      }
    } catch {
      setTownError(t('home.error'));
    } finally {
      setTownBusy(false);
    }
  }

  function meta(place: MapPlace): string {
    return [
      t(`nearby.kind_${place.type}`),
      place.distanceKm !== null ? formatDistance(place.distanceKm, locale) : null,
      place.city,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
        hitSlop={spacing.sm}
        style={styles.backButton}
      >
        <BackChevronIcon size={24} color={colors.text} />
      </Pressable>
      <AccessibleText variant="title" style={styles.title} numberOfLines={2}>
        {t('nearby.title')}
      </AccessibleText>
    </View>
  );

  const controls = (
    <View style={styles.controls}>
      <View style={styles.segment} accessibilityRole="tablist">
        {(['list', 'map'] as const).map((option) => {
          const on = mode === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setMode(option)}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
            >
              <AccessibleText variant="body" color={on ? colors.primaryStrong : colors.text} style={styles.segmentLabel}>
                {t(option === 'list' ? 'nearby.listTab' : 'nearby.mapTab')}
              </AccessibleText>
            </Pressable>
          );
        })}
      </View>

      {kinds.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[null, ...kinds].map((type) => {
            const on = kind === type;
            return (
              <Pressable
                key={type ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setKind(type)}
                style={[styles.chip, on && styles.chipOn]}
              >
                {type && <KindDot type={type} size={20} />}
                <AccessibleText variant="caption" color={on ? colors.primaryStrong : colors.text} style={on ? styles.bold : undefined}>
                  {type ? t(`nearby.kindPlural_${type}`) : t('nearby.all')}
                </AccessibleText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <AccessibleText variant="caption" color={colors.textMuted} style={styles.near}>
        {query
          ? t('nearby.resultsFor', { query })
          : origin?.label
            ? t('nearby.nearPlace', { place: origin.label })
            : t('nearby.nearYou')}
      </AccessibleText>
    </View>
  );

  const card = selected && (
    <PlaceCard
      place={selected}
      meta={meta(selected)}
      isMember={Boolean(me?.pois.some((poi) => poi.id === selected.id))}
      onOpen={() => onOpenPlace(selected)}
      onClose={() => setSelectedId(null)}
    />
  );

  if (mode === 'map') {
    return (
      <Screen>
        {header}
        {controls}
        <View style={[styles.mapArea, { marginBottom: -(insets.bottom + spacing.lg) }]}>
          {mapFailed ? (
            <AccessibleText variant="body" style={styles.empty}>
              {t('nearby.mapUnavailable')}
            </AccessibleText>
          ) : (
            <PlacesMap
              pins={pins}
              origin={mapOrigin}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onError={() => setMapFailed(true)}
              label={t('nearby.mapLabel')}
              style={styles.map}
            />
          )}
          {card && <View style={[styles.docked, { paddingBottom: insets.bottom + spacing.md }]}>{card}</View>}
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {header}
      {controls}
      {failed && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('home.error')}
        </AccessibleText>
      )}
      {!places && !failed && <ActivityIndicator color={colors.primaryStrong} size="large" />}
      {places && shown.length === 0 && (
        <AccessibleText variant="body" style={styles.empty}>
          {t('nearby.empty')}
        </AccessibleText>
      )}
      {shown.length > 0 && (
        <View style={styles.listCard}>
          {shown.map((place, index) => (
            <Pressable
              key={place.id}
              accessibilityRole="button"
              accessibilityLabel={`${place.name}, ${meta(place)}`}
              onPress={() => setSelectedId(place.id)}
              style={[styles.row, index > 0 && styles.rowDivider]}
            >
              <KindDot type={place.type} size={40} />
              <View style={styles.rowText}>
                <AccessibleText variant="body" style={styles.bold}>
                  {place.name}
                </AccessibleText>
                <AccessibleText variant="caption" color={colors.textMuted}>
                  {meta(place)}
                </AccessibleText>
              </View>
              <ChevronRightIcon size={22} color={colors.primaryStrong} />
            </Pressable>
          ))}
        </View>
      )}

      {query && places && (
        <View>
          {townError && (
            <AccessibleText variant="body" color={colors.danger}>
              {townError}
            </AccessibleText>
          )}
          {townBusy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primaryStrong} size="large" />
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => void searchAroundTown()} style={styles.directions}>
              <AccessibleText variant="body" color={colors.primaryStrong} style={styles.bold}>
                {t('nearby.aroundTown', { query })}
              </AccessibleText>
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={Boolean(card)} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <Pressable style={styles.scrim} onPress={() => setSelectedId(null)} accessibilityLabel={t('nearby.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>{card}</View>
      </Modal>
    </Screen>
  );
}

function PlaceCard({
  place,
  meta,
  isMember,
  onOpen,
  onClose,
}: {
  place: MapPlace;
  meta: string;
  isMember: boolean;
  onOpen: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const address = [place.address, [place.postalCode, place.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  async function open() {
    setBusy(true);
    setFailed(false);
    try {
      await onOpen();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <View style={styles.cardInner}>
      <View style={styles.cardHeader}>
        <KindDot type={place.type} size={44} />
        <View style={styles.rowText}>
          <AccessibleText variant="bodyLarge" style={styles.bold}>
            {place.name}
          </AccessibleText>
          <AccessibleText variant="caption" color={colors.textMuted}>
            {meta}
          </AccessibleText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nearby.close')}
          onPress={onClose}
          hitSlop={spacing.sm}
          style={styles.closeButton}
        >
          <CloseIcon size={22} color={colors.text} />
        </Pressable>
      </View>
      {address ? (
        <AccessibleText variant="caption" color={colors.textMuted}>
          {address}
        </AccessibleText>
      ) : null}
      {place.description ? (
        <AccessibleText variant="body" numberOfLines={3}>
          {place.description}
        </AccessibleText>
      ) : null}
      {place.memberCount > 0 && (
        <AccessibleText variant="caption" color={colors.textMuted}>
          {t(place.memberCount === 1 ? 'nearby.memberOne' : 'nearby.members', { count: place.memberCount })}
        </AccessibleText>
      )}
      {failed && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('home.error')}
        </AccessibleText>
      )}
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.primaryStrong} size="large" />
        </View>
      ) : (
        <AccessibleButton label={isMember ? t('nearby.open') : t('nearby.join')} onPress={() => void open()} />
      )}
      {place.latitude !== null && place.longitude !== null && (
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL(
              `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`,
            )
          }
          style={styles.directions}
        >
          <AccessibleText variant="body" color={colors.primaryStrong} style={styles.bold}>
            {t('nearby.directions')}
          </AccessibleText>
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  controls: {
    gap: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  segmentItem: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemOn: {
    backgroundColor: colors.primarySoft,
  },
  segmentLabel: {
    fontWeight: '700',
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 22,
    ...cardSurface,
  },
  chipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  near: {
    marginTop: spacing.xs,
  },
  bold: {
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  listCard: {
    ...cardSurface,
    borderRadius: radii.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  mapArea: {
    flex: 1,
    marginHorizontal: -spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  map: {
    flex: 1,
  },
  docked: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    paddingTop: spacing.md,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.md,
  },
  cardInner: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directions: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
