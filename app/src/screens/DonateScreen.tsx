import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { FormCard, FormDivider, FormField } from '../components/FormCard';
import { CheckIcon, ChevronRightIcon, DownloadIcon, HeartIcon } from '../components/icons';
import { uploadUri } from '../api/client';
import {
  getCampaigns,
  getCardUpdateUrl,
  getDonationStatus,
  getDonationsConfig,
  getMyGifts,
  getMyMonthlyGifts,
  getMyTaxContext,
  requestGiftReceipt,
  startDonationCheckout,
  stopMonthlyGift,
  type Campaign,
  type DonationProject,
  type MonthlyGift,
  type MyGift,
} from '../api/donations';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { cardSurface, colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import { currencySymbol, formatAmount } from '../utils/currency';
import { taxSaving } from '../utils/taxDeduction';
import type { Poi } from '../api/types';

type Props = {
  poi: Poi;
  // A project's own page, or null for the tab itself.
  project: DonationProject | null;
  onOpenProject: (project: DonationProject) => void;
  // Leaves the donation flow once it is confirmed — back to the hub feed.
  onDone: () => void;
  // Giving every month needs an account, so it can be stopped later.
  onSignIn: () => void;
};

const PRESET_AMOUNTS = [5, 10, 20];

const POLL_INTERVAL_MS = 2000;

/**
 * Gifts go through Stripe Checkout: the backend creates the session, the
 * payer finishes on Stripe's own hosted page in the browser, and this screen
 * polls until the payment confirms.
 *
 * Polling rather than a redirect back into the app: Stripe only accepts
 * http(s) redirect URLs, so it can't hand control back to a React Native app
 * directly, and on Android openBrowserAsync resolves as soon as the tab opens
 * rather than when it closes. Polling the backend covers every case — the
 * payer closing the tab, switching apps, or paying on a different device.
 *
 * When the backend has no Stripe key it answers `mode: 'demo'` and the gift is
 * recorded without a payment, so a fresh clone still demos end to end.
 *
 * The confirmation is a screen state rather than Alert.alert(): RN's Alert
 * has no effect at all on the web target (react-native-web doesn't
 * implement it), so a native-only confirmation would look broken there.
 */
export function DonateScreen({ poi, project, onOpenProject, onDone, onSignIn }: Props) {
  const { t, language } = useI18n();
  const { me } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // A project takes one-off gifts only: a monthly payment would outlive it.
  const [monthlyChoice, setMonthly] = useState(false);
  const monthly = monthlyChoice && !project;
  const [wantsReceipt, setWantsReceipt] = useState(false);
  const [receipt, setReceipt] = useState<Receipt>({
    name: [me?.firstName, me?.lastName].filter(Boolean).join(' '),
    address: '',
    postalCode: '',
    city: '',
    taxId: '',
  });
  const [monthlyGifts, setMonthlyGifts] = useState<MonthlyGift[]>([]);
  const [gifts, setGifts] = useState<MyGift[]>([]);
  const [askingReceipt, setAskingReceipt] = useState<string | null>(null);
  const [askSubmitting, setAskSubmitting] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null);
  const [confirmingStop, setConfirmingStop] = useState<string | null>(null);
  const [openingCard, setOpeningCard] = useState<string | null>(null);
  // What the giver already gave here this year, so the tax line knows how
  // much of the 80 % band is left. Signed out, the plain estimate.
  const [taxContext, setTaxContext] = useState<{ givenThisYear: number; recurrent: boolean } | null>(null);
  const [selected, setSelected] = useState<number>(10);
  const [customMode, setCustomMode] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [donated, setDonated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [currency, setCurrency] = useState('eur');
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [pending, setPending] = useState<{ donationId: string; checkoutUrl: string } | null>(null);
  const paidAmount = useRef(0);

  const amount = customMode ? Number(customAmount) || 0 : selected;
  const formatted = (value: number) => formatAmount(value, currency, language);

  useEffect(() => {
    getDonationsConfig()
      .then((config) => {
        setCurrency(config.currency);
        setPaymentsEnabled(config.paymentsEnabled);
      })
      .catch(() => {
        // Keep the defaults — the donate call itself will surface any real
        // connection problem.
      });
  }, []);

  useEffect(() => {
    getCampaigns(poi.id)
      .then(setCampaigns)
      .catch(() => {});
  }, [poi.id]);

  // The giver's own standing gifts and past gifts, when signed in.
  const loadMine = useCallback(() => {
    if (!me) return;
    getMyMonthlyGifts(poi.id)
      .then(setMonthlyGifts)
      .catch(() => {});
    getMyGifts(poi.id)
      .then(setGifts)
      .catch(() => {});
    if (poi.taxScheme && poi.taxScheme !== 'none') {
      getMyTaxContext(poi.id)
        .then(setTaxContext)
        .catch(() => {});
    }
  }, [poi.id, poi.taxScheme, me]);

  useEffect(loadMine, [loadMine]);

  // While the payer is on Stripe's page, ask the backend whether the payment
  // has landed. The backend re-checks with Stripe on each call, so this works
  // without a webhook (the local demo has no public URL for one).
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;

    const timer = setInterval(() => {
      getDonationStatus(poi.id, pending.donationId)
        .then((result) => {
          if (cancelled || result.status === 'pending') return;
          if (result.status === 'completed') {
            paidAmount.current = result.amount;
            setPending(null);
            setDonated(true);
            loadMine();
          } else {
            setPending(null);
            setError(true);
          }
        })
        .catch(() => {
          // A dropped request just means we try again on the next tick.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pending, poi.id, loadMine]);

  async function donate() {
    setSubmitting(true);
    setError(false);
    try {
      const result = await startDonationCheckout(poi.id, {
        amount,
        purpose: project?.kind ?? 'general',
        campaignId: project?.kind === 'campaign' ? project.campaign.id : undefined,
        recurring: monthly || undefined,
        donorName: receipt.name.trim() || undefined,
        wantsReceipt: wantsReceipt || undefined,
        ...(wantsReceipt
          ? {
              donorAddress: receipt.address.trim(),
              donorPostalCode: receipt.postalCode.trim(),
              donorCity: receipt.city.trim(),
              donorTaxId: receipt.taxId.trim() || null,
            }
          : {}),
      });
      if (result.mode === 'demo') {
        paidAmount.current = amount;
        setDonated(true);
        loadMine();
        return;
      }
      paidAmount.current = amount;
      setPending({ donationId: result.donationId, checkoutUrl: result.checkoutUrl });
      // On the web target the browser is opened from the button below instead:
      // window.open() right after an await is treated as a popup and blocked.
      if (Platform.OS !== 'web') {
        await WebBrowser.openBrowserAsync(result.checkoutUrl);
      }
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function stopMonthly(id: string) {
    setStopping(id);
    try {
      await stopMonthlyGift(poi.id, id);
      setMonthlyGifts((current) => current.filter((gift) => gift.id !== id));
      setConfirmingStop(null);
    } catch {
      setError(true);
    } finally {
      setStopping(null);
    }
  }

  // Stripe's own page for a new card; the problem clears once a month is
  // paid again, so the list is fetched again on the way back.
  async function updateCard(id: string) {
    setOpeningCard(id);
    try {
      const { url } = await getCardUpdateUrl(poi.id, id);
      await WebBrowser.openBrowserAsync(url);
      loadMine();
    } catch {
      setError(true);
    } finally {
      setOpeningCard(null);
    }
  }

  function openReceipt(url: string) {
    WebBrowser.openBrowserAsync(uploadUri(url)).catch(() => setError(true));
  }

  // A receipt for a gift made without one: the details, then straight to it.
  async function askReceipt(id: string) {
    setAskSubmitting(true);
    try {
      const updated = await requestGiftReceipt(poi.id, id, {
        donorName: receipt.name.trim(),
        donorAddress: receipt.address.trim(),
        donorPostalCode: receipt.postalCode.trim(),
        donorCity: receipt.city.trim(),
        donorTaxId: receipt.taxId.trim() || null,
      });
      setGifts((current) => current.map((gift) => (gift.id === id ? updated : gift)));
      setAskingReceipt(null);
      if (updated.receiptUrl) openReceipt(updated.receiptUrl);
    } catch {
      setError(true);
    } finally {
      setAskSubmitting(false);
    }
  }

  const askingGift = gifts.find((gift) => gift.id === askingReceipt) ?? null;
  const blockedOnSignIn = monthly && !me;

  if (donated) {
    return (
      <>
        <View style={styles.confirmationIcon}>
          <HeartIcon size={32} color={colors.primary} />
        </View>
        <AccessibleText variant="title" style={styles.centerText}>
          {t('donate.thankYou')}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted} style={styles.centerText}>
          {t(
            monthly
              ? 'donate.monthlyConfirmation'
              : paymentsEnabled
                ? 'donate.confirmation'
                : 'donate.demoConfirmation',
            {
              amount: formatted(paidAmount.current),
              poiName: poi.name,
            },
          )}
        </AccessibleText>
        <View style={styles.spacer} />
        <AccessibleButton label={t('donate.doneButton')} onPress={onDone} />
      </>
    );
  }

  if (pending) {
    return (
      <>
        <View style={styles.confirmationIcon}>
          <HeartIcon size={32} color={colors.primary} />
        </View>
        <AccessibleText variant="title" style={styles.centerText}>
          {t('donate.payingTitle')}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted} style={styles.centerText}>
          {t('donate.payingMessage')}
        </AccessibleText>

        <View style={styles.waitingRow}>
          <ActivityIndicator color={colors.primary} />
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('donate.checkingPayment')}
          </AccessibleText>
        </View>

        <View style={styles.spacer} />

        <AccessibleButton
          label={t('donate.openPaymentButton')}
          onPress={() => {
            WebBrowser.openBrowserAsync(pending.checkoutUrl).catch(() => setError(true));
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('donate.cancelButton')}
          onPress={() => setPending(null)}
          style={styles.textButton}
        >
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('donate.cancelButton')}
          </AccessibleText>
        </Pressable>
      </>
    );
  }

  const isProject = project !== null;
  const campaign = project?.kind === 'campaign' ? project.campaign : null;

  // "What it really costs you": a monthly gift is counted over a year.
  const yearAmount = monthly ? amount * 12 : amount;
  const saving = taxSaving(poi.taxScheme, yearAmount, {
    alreadyGiven: taxContext?.givenThisYear,
    recurrent: taxContext?.recurrent,
  });

  // "5 €, 10 €, 20 €, Other" on one line, then the receipt box: the whole
  // gift fits on one screen, with the button under it.
  const giveForm = (
    <>
      <FormCard>
        {!isProject && (
          <>
            <View style={styles.choiceRow} accessibilityRole="radiogroup">
              {[false, true].map((isMonthly) => {
                const label = isMonthly ? t('donate.monthly') : t('donate.once');
                return (
                  <Choice
                    key={label}
                    label={label}
                    selected={monthly === isMonthly}
                    onPress={() => setMonthly(isMonthly)}
                  />
                );
              })}
            </View>
            <FormDivider />
          </>
        )}
        <View style={styles.choiceRow} accessibilityRole="radiogroup">
          {PRESET_AMOUNTS.map((preset) => (
            <Choice
              key={preset}
              label={formatted(preset)}
              selected={!customMode && preset === selected}
              onPress={() => {
                setCustomMode(false);
                setSelected(preset);
              }}
            />
          ))}
          <Choice label={t('donate.otherAmount')} selected={customMode} onPress={() => setCustomMode(true)} />
        </View>
        {customMode && (
          <>
            <FormDivider />
            <View style={styles.customRow}>
              <AccessibleText variant="caption" color={colors.textMuted}>
                {t('donate.amountLabel')}
              </AccessibleText>
              <View style={styles.customInput}>
                <TextInput
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  keyboardType="number-pad"
                  placeholder="0"
                  autoFocus
                  accessibilityLabel={t('donate.amountLabel')}
                  style={styles.customInputField}
                />
                <AccessibleText variant="bodyLarge" style={styles.bold}>
                  {currencySymbol(currency)}
                </AccessibleText>
              </View>
            </View>
          </>
        )}
        {monthly && !isProject && (
          <AccessibleText variant="caption" style={styles.monthlyHint}>
            {t('donate.monthlyHint')}
          </AccessibleText>
        )}
        {saving > 0 && (
          <>
            <FormDivider />
            <View style={styles.taxRow} accessibilityLiveRegion="polite">
              <AccessibleText variant="body" color={colors.primaryStrong} style={styles.bold}>
                {monthly
                  ? t('donate.taxSavingMonthly', { year: formatted(yearAmount), saving: formatted(saving) })
                  : t('donate.taxSaving', { net: formatted(Math.max(0, amount - saving)), saving: formatted(saving) })}
              </AccessibleText>
              <AccessibleText variant="caption" color={colors.textMuted}>
                {t('donate.taxNote')}
              </AccessibleText>
            </View>
          </>
        )}
        <FormDivider />
        <CheckboxRow
          label={t('donate.receiptToggle')}
          checked={wantsReceipt}
          onToggle={() => setWantsReceipt((value) => !value)}
        />
        {wantsReceipt && (
          <ReceiptFields
            value={receipt}
            onChange={(patch) => setReceipt((current) => ({ ...current, ...patch }))}
          />
        )}
      </FormCard>

      {blockedOnSignIn && (
        <View style={styles.notice}>
          <AccessibleText variant="body">{t('donate.monthlySignIn')}</AccessibleText>
          <AccessibleButton label={t('home.signInButton')} onPress={onSignIn} />
        </View>
      )}

      {error ? (
        <AccessibleText variant="body" color={colors.primaryStrong} style={styles.centerText}>
          {t('donate.error')}
        </AccessibleText>
      ) : null}

      <AccessibleButton
        label={
          submitting
            ? t('donate.processingButton')
            : t(
                campaign ? 'donate.projectButton' : monthly && !isProject ? 'donate.donateMonthlyButton' : 'donate.donateButton',
                { amount: formatted(amount) },
              )
        }
        onPress={donate}
        disabled={submitting || amount <= 0 || !receiptReady(wantsReceipt, receipt) || blockedOnSignIn}
      />

      <AccessibleText variant="caption" style={styles.footnote}>
        {t(paymentsEnabled ? 'donate.footnote' : 'donate.demoFootnote')}
      </AccessibleText>
    </>
  );

  if (campaign) {
    const title = campaign.title;
    const description = campaign.description;
    return (
      <>
        {campaign.imageUrl ? (
          <Image
            source={{ uri: uploadUri(campaign.imageUrl) }}
            style={styles.hero}
            resizeMode="cover"
            accessibilityLabel={campaign.title}
          />
        ) : null}
        <View style={styles.titleBlock}>
          <AccessibleText variant="title" style={styles.title} accessibilityRole="header">
            {title}
          </AccessibleText>
          {!!description && <AccessibleText variant="body">{description}</AccessibleText>}
        </View>
        <Progress campaign={campaign} formatted={formatted} large />
        {!!campaign.allocation?.length && (
          <>
            <AccessibleText variant="caption" style={styles.sectionLabel}>
              {t('donate.allocationTitle')}
            </AccessibleText>
            <View style={styles.listCard}>
              {campaign.allocation.map((line, index) => (
                <View
                  key={`${line.label}-${index}`}
                  style={[styles.allocationRow, index > 0 && styles.divider]}
                  accessible
                  accessibilityLabel={`${line.label}: ${line.percent} %`}
                >
                  <View style={styles.allocationText}>
                    <AccessibleText variant="body" style={styles.flex}>
                      {line.label}
                    </AccessibleText>
                    <AccessibleText variant="body" style={styles.bold}>
                      {`${line.percent} %`}
                    </AccessibleText>
                  </View>
                  <View style={styles.allocationTrack}>
                    <View style={[styles.allocationFill, { width: `${Math.min(100, line.percent)}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
        {giveForm}
      </>
    );
  }

  return (
    <>
      <AccessibleText variant="title" style={styles.title} accessibilityRole="header">
        {t('donate.giveTitle')}
      </AccessibleText>

      {giveForm}

      {campaigns.length > 0 && (
        <>
          <AccessibleText variant="caption" style={styles.sectionLabel}>
            {t('donate.projectsLabel')}
          </AccessibleText>
          <View style={styles.listCard}>
            {campaigns.map((item, index) => (
              <ProjectRow
                key={item.id}
                title={item.title}
                imageUrl={item.imageUrl}
                divider={index > 0}
                onPress={() => onOpenProject({ kind: 'campaign', campaign: item })}
              >
                <Progress campaign={item} formatted={formatted} />
              </ProjectRow>
            ))}
          </View>
        </>
      )}

      {monthlyGifts.length > 0 && (
        <>
          <AccessibleText variant="caption" style={styles.sectionLabel}>
            {t(monthlyGifts.length > 1 ? 'donate.myMonthly' : 'donate.myMonthlyGift')}
          </AccessibleText>
          <View style={styles.listCard}>
            {monthlyGifts.map((gift, index) => (
              <View key={gift.id} style={[styles.mineRow, index > 0 && styles.divider]}>
                <AccessibleText variant="bodyLarge" style={styles.bold}>
                  {t('donate.monthlyAmount', { amount: formatted(gift.amount) })}
                </AccessibleText>
                <AccessibleText variant="caption">
                  {gift.campaign?.title ??
                    t(gift.purpose === 'collection' ? 'donate.purposeCollection' : 'donate.purposeGeneral')}
                  {' · '}
                  {t('donate.since', {
                    date: new Date(gift.createdAt).toLocaleDateString(intlLocale(language), { month: 'long', year: 'numeric' }),
                  })}
                </AccessibleText>
                {!!gift.paymentProblem && (
                  <>
                    <AccessibleText variant="body" color={colors.danger} style={styles.bold}>
                      {t(gift.paymentProblem === 'failed' ? 'donate.paymentFailed' : 'donate.cardExpiring')}
                    </AccessibleText>
                    <AccessibleButton
                      label={openingCard === gift.id ? t('donate.processingButton') : t('donate.updateCard')}
                      onPress={() => updateCard(gift.id)}
                      disabled={openingCard === gift.id}
                    />
                  </>
                )}
                {confirmingStop === gift.id ? (
                  <View style={styles.confirm}>
                    <AccessibleText variant="body" style={styles.bold}>
                      {t('donate.stopQuestion')}
                    </AccessibleText>
                    <AccessibleButton
                      label={stopping === gift.id ? t('donate.processingButton') : t('donate.stopConfirm')}
                      onPress={() => stopMonthly(gift.id)}
                      disabled={stopping === gift.id}
                    />
                    <AccessibleButton
                      variant="secondary"
                      label={t('donate.stopKeep')}
                      onPress={() => setConfirmingStop(null)}
                    />
                  </View>
                ) : (
                  <AccessibleButton
                    variant="destructive"
                    label={t('donate.stopMonthly')}
                    onPress={() => setConfirmingStop(gift.id)}
                  />
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {gifts.length > 0 && (
        <>
          <AccessibleText variant="caption" style={styles.sectionLabel}>
            {t('donate.myGifts')}
          </AccessibleText>
          <View style={styles.listCard}>
            {gifts.map((gift, index) => {
              const date = new Date(gift.createdAt).toLocaleDateString(intlLocale(language), {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              const amountText = formatted(gift.amount);
              return (
                <View key={gift.id} style={[styles.giftRow, index > 0 && styles.divider]}>
                  <View style={styles.flex}>
                    <AccessibleText variant="body" style={styles.bold}>
                      {`${amountText} · ${giftLabel(gift, t)}`}
                    </AccessibleText>
                    <AccessibleText variant="caption">{date}</AccessibleText>
                  </View>
                  {gift.receiptUrl ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={t('donate.taxReceiptFor', { amount: amountText, date })}
                      onPress={() => openReceipt(gift.receiptUrl!)}
                      style={styles.receiptLink}
                    >
                      <DownloadIcon size={24} color={colors.primaryStrong} />
                      <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.bold}>
                        {t('donate.taxReceipt')}
                      </AccessibleText>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setAskingReceipt(askingReceipt === gift.id ? null : gift.id)}
                      style={styles.receiptLink}
                    >
                      <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.bold}>
                        {t('donate.askReceipt')}
                      </AccessibleText>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          {askingGift && (
            <>
              <AccessibleText variant="body" style={styles.bold}>
                {t('donate.askReceiptTitle', {
                  amount: formatted(askingGift.amount),
                  date: new Date(askingGift.createdAt).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long' }),
                })}
              </AccessibleText>
              <FormCard>
                <ReceiptFields
                  value={receipt}
                  onChange={(patch) => setReceipt((current) => ({ ...current, ...patch }))}
                  first
                />
              </FormCard>
              <AccessibleButton
                label={askSubmitting ? t('donate.processingButton') : t('donate.getReceiptButton')}
                onPress={() => askReceipt(askingGift.id)}
                disabled={askSubmitting || !receiptReady(true, receipt)}
              />
              <AccessibleButton variant="secondary" label={t('donate.cancelButton')} onPress={() => setAskingReceipt(null)} />
            </>
          )}
        </>
      )}
    </>
  );
}

type Receipt = { name: string; address: string; postalCode: string; city: string; taxId: string };

function receiptReady(wanted: boolean, receipt: Receipt): boolean {
  return !wanted || (!!receipt.name.trim() && !!receipt.address.trim() && !!receipt.postalCode.trim() && !!receipt.city.trim());
}

function giftLabel(gift: MyGift, t: ReturnType<typeof useI18n>['t']): string {
  if (gift.campaignTitle) return gift.campaignTitle;
  if (gift.purpose === 'collection') return t('donate.purposeCollection');
  if (gift.purpose === 'mass_intention') return t('donate.giftIntention');
  return t(gift.recurring ? 'donate.giftMonthly' : 'donate.giftGeneral');
}

/** One of a few side-by-side choices: the chosen one in the coral wash. */
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <AccessibleText
        variant="body"
        style={styles.choiceText}
        color={selected ? colors.primaryStrong : colors.text}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </AccessibleText>
    </Pressable>
  );
}

function CheckboxRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={styles.checkboxRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <CheckIcon size={20} color={colors.primaryText} />}
      </View>
      <AccessibleText variant="body" style={styles.flex}>
        {label}
      </AccessibleText>
    </Pressable>
  );
}

/** Who the receipt is for, as rows of the card it sits in. */
function ReceiptFields({
  value,
  onChange,
  first = false,
}: {
  value: Receipt;
  onChange: (patch: Partial<Receipt>) => void;
  first?: boolean;
}) {
  const { t } = useI18n();
  return (
    <>
      {!first && <FormDivider />}
      <FormField label={t('donate.nameLabel')} value={value.name} onChangeText={(name) => onChange({ name })} autoComplete="name" />
      <FormDivider />
      <FormField
        label={t('donate.addressLabel')}
        value={value.address}
        onChangeText={(address) => onChange({ address })}
        autoComplete="street-address"
      />
      <FormDivider />
      <FormField
        label={t('donate.postalCodeLabel')}
        value={value.postalCode}
        onChangeText={(postalCode) => onChange({ postalCode })}
        autoComplete="postal-code"
      />
      <FormDivider />
      <FormField label={t('donate.cityLabel')} value={value.city} onChangeText={(city) => onChange({ city })} />
      <FormDivider />
      <FormField
        label={t('donate.taxIdLabel')}
        value={value.taxId}
        onChangeText={(taxId) => onChange({ taxId })}
        autoCapitalize="characters"
      />
    </>
  );
}

function Progress({
  campaign,
  formatted,
  large = false,
}: {
  campaign: Campaign;
  formatted: (value: number) => string;
  large?: boolean;
}) {
  const { t } = useI18n();
  const text = campaign.goalAmount
    ? t('donate.projectRaised', { raised: formatted(campaign.raised), goal: formatted(campaign.goalAmount) })
    : t('donate.projectRaisedNoGoal', { raised: formatted(campaign.raised) });
  return (
    <View style={styles.progress}>
      {campaign.goalAmount ? (
        <View
          style={[styles.progressTrack, large && styles.progressTrackLarge]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: campaign.goalAmount, now: campaign.raised }}
        >
          <View
            style={[styles.progressFill, { width: `${Math.min(100, (campaign.raised / campaign.goalAmount) * 100)}%` }]}
          />
        </View>
      ) : null}
      <AccessibleText variant={large ? 'body' : 'caption'}>{text}</AccessibleText>
    </View>
  );
}

/** A project in the list: its picture, its name and how far it has got. */
function ProjectRow({
  title,
  imageUrl,
  divider,
  onPress,
  children,
}: {
  title: string;
  imageUrl: string | null;
  divider: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[styles.projectRow, divider && styles.divider]}
    >
      {imageUrl ? (
        <Image source={{ uri: uploadUri(imageUrl) }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <HeartIcon size={28} color={colors.primaryText} />
        </View>
      )}
      <View style={styles.flex}>
        <AccessibleText variant="bodyLarge" style={styles.bold}>
          {title}
        </AccessibleText>
        {children}
      </View>
      <ChevronRightIcon size={22} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  listCard: {
    ...cardSurface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  progress: {
    gap: spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cardBorder,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  notice: {
    ...cardSurface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  mineRow: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  confirm: {
    gap: spacing.sm,
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
  centerText: {
    textAlign: 'center',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  textButton: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  title: {
    fontSize: 28,
  },
  sectionLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
  },
  spacer: {
    flexGrow: 1,
    minHeight: spacing.lg,
  },
  footnote: {
    textAlign: 'center',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  // A button inside the card, so it keeps a heavier edge of its own.
  choice: {
    flex: 1,
    minHeight: minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: {
    fontWeight: '800',
  },
  customRow: {
    paddingVertical: spacing.sm,
  },
  customInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customInputField: {
    flex: 1,
    minHeight: minTouchTarget,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  monthlyHint: {
    paddingBottom: spacing.sm,
  },
  // The tax line: text on the white card, no box of its own.
  taxRow: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  allocationRow: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  allocationText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  allocationTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
    overflow: 'hidden',
  },
  allocationFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
  },
  progressTrackLarge: {
    height: 12,
    borderRadius: 6,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
  },
  thumbEmpty: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: minTouchTarget,
  },
  // The receipt, said with an arrow and a word, as big a target as a button.
  receiptLink: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
}));
