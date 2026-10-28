import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleText } from './AccessibleText';
import { CheckIcon, CloseIcon, PlusIcon } from './icons';
import { PlaceMark } from './PlaceMark';
import { MadeWith } from './MadeWith';
import type { SavedPlace } from '../storage/savedPlaces';
import { colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import { useI18n } from '../i18n/I18nContext';

type Props = {
  visible: boolean;
  places: SavedPlace[];
  currentPoiId: string;
  // The place being fetched after a tap, if any: only its id is stored on
  // the device, so opening it means a round trip that can fail.
  busyPlaceId: string | null;
  failed: boolean;
  onSelect: (place: SavedPlace) => void;
  onAddPlace: () => void;
  onClose: () => void;
};

/**
 * Bottom sheet behind the place name in the hub banner: the places this
 * device has already been to, plus a way to add another one. Places are
 * remembered locally (see storage/savedPlaces) — congregants have no
 * account yet, so there is no server-side list to read.
 */
export function PlaceSwitcher({
  visible,
  places,
  currentPoiId,
  busyPlaceId,
  failed,
  onSelect,
  onAddPlace,
  onClose,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the dimmed area closes the sheet, the usual way out of a
          bottom sheet — the explicit close button below is what the
          screen reader announces. */}
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('places.close')} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.sheetHeader}>
          <AccessibleText variant="bodyLarge" style={styles.sheetTitle}>
            {t('places.title')}
          </AccessibleText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('places.close')}
            onPress={onClose}
            style={styles.closeButton}
          >
            <CloseIcon size={22} color={colors.text} />
          </Pressable>
        </View>

        {failed && (
          <AccessibleText variant="body" color={colors.danger} style={styles.error}>
            {t('home.error')}
          </AccessibleText>
        )}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {places.map((place) => {
            const isCurrent = place.id === currentPoiId;
            return (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent }}
                accessibilityLabel={place.name}
                onPress={() => (isCurrent ? onClose() : onSelect(place))}
                style={[styles.row, isCurrent && styles.rowCurrent]}
              >
                <PlaceMark place={place} size={40} />
                <View style={styles.rowText}>
                  <AccessibleText variant="body" numberOfLines={1} style={styles.rowName}>
                    {place.name}
                  </AccessibleText>
                  {place.city ? (
                    <AccessibleText variant="caption" numberOfLines={1}>
                      {place.city}
                    </AccessibleText>
                  ) : null}
                </View>
                {busyPlaceId === place.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  isCurrent && <CheckIcon size={24} color={colors.primaryStrong} />
                )}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('places.addPlace')}
            onPress={onAddPlace}
            style={[styles.row, styles.rowAction, styles.rowLast]}
          >
            <PlusIcon size={26} color={colors.primaryStrong} />
            <View style={styles.rowText}>
              <AccessibleText variant="body" style={styles.rowName}>
                {t('places.addPlace')}
              </AccessibleText>
            </View>
          </Pressable>
          <MadeWith />
        </ScrollView>
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
    paddingTop: spacing.md,
    // Leaves the scrim tappable above the sheet however many places are
    // listed.
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    flex: 1,
    fontWeight: '800',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Rows in a white sheet, so they carry no fill and no border of their
  // own — a hairline between them is all the separation they need, and
  // anything more would be a box inside a box.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 10,
    // Coral rather than a grey hairline: on a white sheet it is the one
    // line that says where one place ends and the next begins.
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  rowCurrent: {},
  // The last row in the sheet: a line under it would separate it from
  // nothing.
  rowLast: {
    borderBottomWidth: 0,
  },
  rowAction: {},
  rowText: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  rowName: {
    fontWeight: '700',
  },
}));
