import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { FormCard, FormDivider, FormField } from '../components/FormCard';
import { ChaliceIcon, CheckIcon } from '../components/icons';
import { getDonationsConfig } from '../api/donations';
import { getEvents } from '../api/events';
import {
  createMassIntention,
  getMassIntentionSettings,
  getMassIntentionStatus,
  getMyMassIntentions,
  type MassIntention,
} from '../api/massIntentions';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { Poi } from '../api/types';
import { formatAmount } from '../utils/currency';
import { formatWhen, upcomingOccurrences, type Occurrence } from '../utils/schedule';
import { cardSurface, colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  poi: Poi;
};

// How many of the coming Masses are offered to choose from.
const MASSES_OFFERED = 8;

// What someone may give where the community has not set an offering.
const OFFERING_CHOICES = [10, 20, 50, 0];

const POLL_INTERVAL_MS = 2000;

// The Mass chosen: an occurrence, or null for "whenever the community can".
type Choice = { eventId: string; startsAt: Date } | null;

/**
 * Asking for a Mass to be said for someone: a person who has died, a
 * sick relative, a thanksgiving. The intention goes on the community's
 * register for the chosen Mass; the offering, where there is one, is paid
 * the same way as a gift (Stripe, or the demo without it).
 */
export function MassIntentionsScreen({ poi }: Props) {
  const { t, language } = useI18n();
  const { me } = useAuth();
  const [masses, setMasses] = useState<Occurrence[] | null>(null);
  const [fixedOffering, setFixedOffering] = useState<number | null>(null);
  const [currency, setCurrency] = useState('eur');
  const [intention, setIntention] = useState('');
  const [name, setName] = useState([me?.firstName, me?.lastName].filter(Boolean).join(' '));
  const [contact, setContact] = useState(me?.phone ?? me?.email ?? '');
  const [choice, setChoice] = useState<Choice>(null);
  const [offering, setOffering] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<{ id: string; checkoutUrl: string } | null>(null);
  const [done, setDone] = useState<{ when: Choice } | null>(null);
  const [mine, setMine] = useState<MassIntention[] | null>(null);

  const formatted = (value: number) => formatAmount(value, currency, language);
  const amount = fixedOffering ?? offering;
  const now = new Date();
  const when = (date: Date) =>
    formatWhen(date, now, language, { today: t('schedule.today'), tomorrow: t('schedule.tomorrow') });

  useEffect(() => {
    getEvents(poi.id)
      .then((events) =>
        setMasses(upcomingOccurrences(events, new Date(), MASSES_OFFERED, (e) => e.category === 'mass')),
      )
      .catch(() => setMasses([]));
    getMassIntentionSettings(poi.id)
      .then((settings) => setFixedOffering(settings.offeringAmount))
      .catch(() => {});
    getDonationsConfig()
      .then((config) => setCurrency(config.currency))
      .catch(() => {});
  }, [poi.id]);

  useEffect(() => {
    if (!me || pending) return;
    getMyMassIntentions(poi.id)
      .then(setMine)
      .catch(() => {});
  }, [poi.id, me, pending, done]);

  // While the offering is being paid on Stripe's page, wait for it to land.
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const timer = setInterval(() => {
      getMassIntentionStatus(poi.id, pending.id)
        .then((result) => {
          if (cancelled || result.status === 'pending_payment') return;
          setPending(null);
          if (result.status === 'cancelled') setError(true);
          else setDone({ when: choice });
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pending, poi.id, choice]);

  async function submit() {
    setSubmitting(true);
    setError(false);
    try {
      const result = await createMassIntention(poi.id, {
        intention: intention.trim(),
        requesterName: name.trim(),
        requesterContact: contact.trim() || null,
        eventId: choice?.eventId ?? null,
        celebrationAt: choice ? choice.startsAt.toISOString() : null,
        offeringAmount: fixedOffering === null ? offering : undefined,
      });
      if (result.checkout?.mode === 'stripe') {
        setPending({ id: result.intention.id, checkoutUrl: result.checkout.checkoutUrl });
        if (Platform.OS !== 'web') await WebBrowser.openBrowserAsync(result.checkout.checkoutUrl);
        return;
      }
      setDone({ when: choice });
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  function startAgain() {
    setDone(null);
    setIntention('');
    setChoice(null);
  }

  if (done) {
    return (
      <>
        <View style={styles.confirmationIcon}>
          <ChaliceIcon size={32} color={colors.primary} />
        </View>
        <AccessibleText variant="title" style={styles.center}>
          {t('intentions.thankYou')}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted} style={styles.center}>
          {done.when
            ? t('intentions.confirmedFor', { when: when(done.when.startsAt) })
            : t('intentions.confirmedWhenever')}
        </AccessibleText>
        <AccessibleButton label={t('intentions.another')} onPress={startAgain} />
      </>
    );
  }

  if (pending) {
    return (
      <>
        <View style={styles.confirmationIcon}>
          <ChaliceIcon size={32} color={colors.primary} />
        </View>
        <AccessibleText variant="title" style={styles.center}>
          {t('intentions.payingTitle')}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted} style={styles.center}>
          {t('donate.payingMessage')}
        </AccessibleText>
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.primary} />
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('donate.checkingPayment')}
          </AccessibleText>
        </View>
        <AccessibleButton
          label={t('donate.openPaymentButton')}
          onPress={() => {
            WebBrowser.openBrowserAsync(pending.checkoutUrl).catch(() => setError(true));
          }}
        />
        <AccessibleButton variant="secondary" label={t('donate.cancelButton')} onPress={() => setPending(null)} />
      </>
    );
  }

  const ready = !!intention.trim() && !!name.trim();

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('intentions.title')}</AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('intentions.subtitle')}
        </AccessibleText>
      </View>

      <FormCard>
        <FormField
          label={t('intentions.intentionLabel')}
          placeholder={t('intentions.intentionPlaceholder')}
          value={intention}
          onChangeText={setIntention}
          multiline
          tall
        />
        <FormDivider />
        <FormField label={t('intentions.nameLabel')} value={name} onChangeText={setName} autoComplete="name" />
        <FormDivider />
        <FormField label={t('intentions.contactLabel')} value={contact} onChangeText={setContact} />
      </FormCard>

      <AccessibleText variant="caption" style={styles.sectionLabel}>
        {t('intentions.whichMass')}
      </AccessibleText>
      <View style={styles.listCard} accessibilityRole="radiogroup">
        {masses === null && (
          <AccessibleText variant="body" color={colors.textMuted} style={styles.listNote}>
            {t('common.loading')}
          </AccessibleText>
        )}
        {(masses ?? []).map((mass, index) => {
          const selected = choice?.eventId === mass.event.id && choice.startsAt.getTime() === mass.startsAt.getTime();
          const label = when(mass.startsAt);
          return (
            <ChoiceRow
              key={`${mass.event.id}:${mass.startsAt.getTime()}`}
              label={label}
              detail={[mass.event.title, mass.event.location].filter(Boolean).join(' · ')}
              selected={selected}
              divider={index > 0}
              onPress={() => setChoice({ eventId: mass.event.id, startsAt: mass.startsAt })}
            />
          );
        })}
        <ChoiceRow
          label={t('intentions.whenever')}
          selected={choice === null}
          divider={(masses ?? []).length > 0}
          onPress={() => setChoice(null)}
        />
      </View>

      <AccessibleText variant="caption" style={styles.sectionLabel}>
        {t('intentions.offering')}
      </AccessibleText>
      {fixedOffering !== null ? (
        <AccessibleText variant="body">
          {fixedOffering > 0
            ? t('intentions.offeringFixed', { amount: formatted(fixedOffering) })
            : t('intentions.offeringNone')}
        </AccessibleText>
      ) : (
        <View style={styles.grid}>
          {OFFERING_CHOICES.map((value) => {
            const selected = value === offering;
            const label = value === 0 ? t('intentions.noOffering') : formatted(value);
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={label}
                onPress={() => setOffering(value)}
                style={[styles.amountCell, selected && styles.amountCellSelected]}
              >
                <AccessibleText
                  variant={value === 0 ? 'body' : 'bodyLarge'}
                  color={selected ? colors.primaryStrong : colors.text}
                  style={styles.amountText}
                >
                  {label}
                </AccessibleText>
              </Pressable>
            );
          })}
        </View>
      )}

      {error && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('intentions.error')}
        </AccessibleText>
      )}

      <AccessibleButton
        label={
          submitting
            ? t('donate.processingButton')
            : amount > 0
              ? t('intentions.submitWithOffering', { amount: formatted(amount) })
              : t('intentions.submit')
        }
        onPress={submit}
        disabled={!ready || submitting}
      />

      {!!mine?.length && (
        <>
          <AccessibleText variant="caption" style={styles.sectionLabel}>
            {t('intentions.mine')}
          </AccessibleText>
          <View style={styles.listCard}>
            {mine.map((item, index) => (
              <View key={item.id} style={[styles.mineRow, index > 0 && styles.divider]}>
                <AccessibleText variant="body" style={styles.bold}>
                  {item.intention}
                </AccessibleText>
                <AccessibleText variant="caption">
                  {item.celebrationAt ? when(new Date(item.celebrationAt)) : t('intentions.whenever')}
                </AccessibleText>
                <AccessibleText
                  variant="caption"
                  color={item.status === 'confirmed' ? colors.primaryStrong : colors.textMuted}
                  style={styles.bold}
                >
                  {t(`intentions.status_${item.status}`)}
                </AccessibleText>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

function ChoiceRow({
  label,
  detail,
  selected,
  divider,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={[styles.choiceRow, divider && styles.divider, selected && styles.choiceRowSelected]}
    >
      <View style={styles.flex}>
        <AccessibleText
          variant="body"
          color={selected ? colors.primaryStrong : colors.text}
          style={selected ? styles.bold : undefined}
        >
          {label}
        </AccessibleText>
        {!!detail && <AccessibleText variant="caption">{detail}</AccessibleText>}
      </View>
      {selected && <CheckIcon size={24} color={colors.primaryStrong} />}
    </Pressable>
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
  bold: {
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  confirmationIcon: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    ...cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  listCard: {
    ...cardSurface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  listNote: {
    padding: spacing.md,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  mineRow: {
    padding: spacing.md,
    gap: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  amountCell: {
    width: '46%',
    flexGrow: 1,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    ...cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountCellSelected: {
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  amountText: {
    fontWeight: '800',
  },
}));
