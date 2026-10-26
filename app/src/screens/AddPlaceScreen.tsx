import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../components/Screen';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { FormCard, FormField } from '../components/FormCard';
import { Lockup } from '../components/Logo';
import { getPoiByQrCode } from '../api/pois';
import { geocode, getMapPlaces, type Origin } from '../api/placesMap';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import { currentPosition } from '../utils/location';
import type { Poi } from '../api/types';
import { colors, minTouchTarget, spacing, themedStyles } from '../theme/theme';

type Props = {
  onScanQR: () => void;
  onOpenPoi: (poi: Poi) => void;
  // "Near you" around the phone, or around the town the person typed.
  onFindNearby: (origin: Origin) => void;
  // The communities whose name holds what the person typed.
  onFindByName: (query: string) => void;
  // Absent for somebody who has no places yet: there is nothing to go
  // back to, so the screen shows no way out.
  onBack?: () => void;
};

/**
 * Where a signed-in person with no place yet arrives, and where "add
 * another" leads afterwards. Three ways in: the communities around them
 * (their position, asked once and never stored), a community's name or a
 * town they type, and the flyer's QR code or the code printed under it.
 */
export function AddPlaceScreen({ onScanQR, onOpenPoi, onFindNearby, onFindByName, onBack }: Props) {
  const { t, language } = useI18n();
  const [code, setCode] = useState('');
  const [town, setTown] = useState('');
  const [busy, setBusy] = useState<'code' | 'position' | 'town' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  async function openByCode() {
    setBusy('code');
    setError(null);
    try {
      onOpenPoi(await getPoiByQrCode(code.trim()));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? t('scan.codeNotFound')
          : t('home.error'),
      );
    } finally {
      setBusy(null);
    }
  }

  async function useMyPosition() {
    setBusy('position');
    setNearbyError(null);
    const position = await currentPosition();
    setBusy(null);
    if (position === 'denied') {
      setNearbyError(t('nearby.locationDenied'));
    } else if (position === 'unavailable') {
      setNearbyError(t('nearby.locationUnavailable'));
    } else {
      onFindNearby({ ...position, label: null });
    }
  }

  // A community's name first; when no name holds the words, a town.
  async function searchTown() {
    const query = town.trim();
    if (!query) return;
    setBusy('town');
    setNearbyError(null);
    try {
      if ((await getMapPlaces(null, query)).length > 0) {
        onFindByName(query);
        return;
      }
      const [first] = await geocode(query, language);
      if (first) {
        onFindNearby({ latitude: first.latitude, longitude: first.longitude, label: first.city ?? query });
      } else {
        setNearbyError(t('nearby.townNotFound'));
      }
    } catch {
      setNearbyError(t('home.error'));
    } finally {
      setBusy(null);
    }
  }

  const spinner = (
    <View style={styles.busy}>
      <ActivityIndicator color={colors.primaryStrong} size="large" />
    </View>
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Lockup height={48} />
      </View>

      <AccessibleText variant="bodyLarge" style={styles.lead}>
        {t('nearby.addTitle')}
      </AccessibleText>
      <AccessibleText variant="body" color={colors.textMuted}>
        {t('nearby.addExplainer')}
      </AccessibleText>

      {nearbyError && (
        <AccessibleText variant="body" color={colors.danger}>
          {nearbyError}
        </AccessibleText>
      )}

      {busy === 'position' ? spinner : (
        <AccessibleButton label={t('nearby.useLocation')} onPress={() => void useMyPosition()} />
      )}

      <FormCard>
        <FormField
          label={t('nearby.townLabel')}
          value={town}
          onChangeText={(value) => {
            setTown(value);
            setNearbyError(null);
          }}
          placeholder={t('nearby.townPlaceholder')}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void searchTown()}
        />
      </FormCard>
      {town.trim().length > 0 &&
        (busy === 'town' ? spinner : (
          <AccessibleButton label={t('nearby.townSearch')} variant="secondary" onPress={() => void searchTown()} />
        ))}

      <AccessibleText variant="bodyLarge" style={styles.section}>
        {t('nearby.haveCode')}
      </AccessibleText>

      {error && (
        <AccessibleText variant="body" color={colors.danger}>
          {error}
        </AccessibleText>
      )}

      <AccessibleButton label={t('home.scanButton')} variant="secondary" onPress={onScanQR} />

      <FormCard>
        <FormField
          label={t('addPlace.codeLabel')}
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={() => code.trim() && void openByCode()}
        />
      </FormCard>

      {busy === 'code' ? spinner : (
        <AccessibleButton
          label={t('scan.codeButton')}
          variant="secondary"
          disabled={code.trim().length === 0}
          style={code.trim() ? undefined : styles.buttonDisabled}
          onPress={() => void openByCode()}
        />
      )}

      {onBack && (
        <AccessibleButton label={t('common.back')} variant="secondary" onPress={onBack} />
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lead: {
    fontWeight: '700',
  },
  section: {
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  busy: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
