import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { FormCard, FormDivider, FormField } from '../components/FormCard';
import { CheckIcon } from '../components/icons';
import { createRequest, type RequestType } from '../api/requests';
import { requestTypeKey, requestTypesFor } from '../utils/requestTypes';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { Poi } from '../api/types';
import { cardSurface, colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  poi: Poi;
  // With the new request's id, to open it straight away.
  onCreated: (id: string) => void;
};

/**
 * Asking the office for something. What it is for comes first, as a list
 * to tick rather than a dropdown: the whole choice is visible at once, at
 * a size an older hand can hit.
 */
export function NewRequestScreen({ poi, onCreated }: Props) {
  const { t } = useI18n();
  const { me } = useAuth();
  const [type, setType] = useState<RequestType | null>(null);
  const [contactName, setContactName] = useState(
    [me?.firstName, me?.lastName].filter(Boolean).join(' '),
  );
  const [contactPhone, setContactPhone] = useState(me?.phone ?? '');
  const [preferredDate, setPreferredDate] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const ready = !!type && !!contactName.trim() && !!details.trim();

  async function send() {
    if (!type || !ready) return;
    setSending(true);
    setError(false);
    try {
      const created = await createRequest(poi.id, {
        type,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim() || null,
        preferredDate: preferredDate.trim() || null,
        details: details.trim(),
      });
      onCreated(created.id);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('requests.newTitle')}</AccessibleText>
      </View>

      <AccessibleText variant="caption" style={styles.sectionLabel}>
        {t('requests.chooseType')}
      </AccessibleText>
      <View style={styles.typeCard} accessibilityRole="radiogroup">
        {requestTypesFor(poi.type).map((option, index) => {
          const selected = option === type;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={t(requestTypeKey(option, poi.type))}
              onPress={() => setType(option)}
              style={[styles.typeRow, index > 0 && styles.typeRowDivider, selected && styles.typeRowSelected]}
            >
              <AccessibleText
                variant="body"
                color={selected ? colors.primaryStrong : colors.text}
                style={[styles.typeLabel, selected && styles.typeLabelSelected]}
              >
                {t(requestTypeKey(option, poi.type))}
              </AccessibleText>
              {selected && <CheckIcon size={24} color={colors.primaryStrong} />}
            </Pressable>
          );
        })}
      </View>

      <FormCard>
        <FormField
          label={t('requests.nameLabel')}
          value={contactName}
          onChangeText={setContactName}
          autoComplete="name"
        />
        <FormDivider />
        <FormField
          label={t('requests.phoneLabel')}
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <FormDivider />
        <FormField
          label={t('requests.dateLabel')}
          placeholder={t('requests.datePlaceholder')}
          value={preferredDate}
          onChangeText={setPreferredDate}
        />
        <FormDivider />
        <FormField
          label={t('requests.detailsLabel')}
          placeholder={t('requests.detailsPlaceholder')}
          value={details}
          onChangeText={setDetails}
          multiline
          tall
        />
      </FormCard>

      {error && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('requests.actionError')}
        </AccessibleText>
      )}

      <AccessibleButton
        label={sending ? t('requests.sending') : t('requests.send')}
        onPress={send}
        disabled={!ready || sending}
      />
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
  },
  typeCard: {
    ...cardSurface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
  },
  typeRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  typeRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  typeLabel: {
    flex: 1,
  },
  typeLabelSelected: {
    fontWeight: '700',
  },
}));
