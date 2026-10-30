import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Screen } from '../components/Screen';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { FormCard, FormDivider } from '../components/FormCard';
import { CheckIcon } from '../components/icons';
import { Lockup } from '../components/Logo';
import { acceptTerms } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { PRIVACY_URL, TERMS_URL } from '../legal';
import { colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';

/**
 * Asked once after signing in, and again whenever the terms change: the
 * person confirms they are 14 or older (the age Spanish law sets for
 * consenting on their own) and accepts the terms and privacy policy.
 * Nothing else in the app opens until they have, and what they accepted
 * is recorded on their account with the date.
 */
export function ConsentScreen() {
  const { t } = useI18n();
  const { me, refresh, signOut } = useAuth();
  const [isOldEnough, setIsOldEnough] = useState(false);
  const [accepts, setAccepts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (!me?.consentVersion) return;
    setBusy(true);
    setFailed(false);
    try {
      await acceptTerms(me.consentVersion);
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.brand}>
        <Lockup height={48} />
      </View>
      <AccessibleText variant="title">{t('privacy.termsTitle')}</AccessibleText>
      <AccessibleText variant="body" color={colors.textMuted}>
        {t('privacy.termsIntro')}
      </AccessibleText>

      <FormCard>
        <TickRow label={t('privacy.ageCheck')} checked={isOldEnough} onToggle={() => setIsOldEnough((v) => !v)} />
        <FormDivider />
        <TickRow label={t('privacy.termsCheck')} checked={accepts} onToggle={() => setAccepts((v) => !v)} />
      </FormCard>

      <View style={styles.links}>
        <LinkText label={t('privacy.readTerms')} url={TERMS_URL} />
        <LinkText label={t('privacy.readPrivacy')} url={PRIVACY_URL} />
      </View>

      {failed && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('privacy.termsError')}
        </AccessibleText>
      )}

      <AccessibleButton
        label={t('privacy.continue')}
        onPress={() => void confirm()}
        disabled={busy || !isOldEnough || !accepts}
        style={isOldEnough && accepts ? undefined : styles.buttonDisabled}
      />
      <AccessibleButton label={t('home.signOutButton')} variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

function TickRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={styles.tickRow}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <CheckIcon size={20} color={colors.primaryText} />}
      </View>
      <AccessibleText variant="bodyLarge" style={styles.tickLabel}>
        {label}
      </AccessibleText>
    </Pressable>
  );
}

function LinkText({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void WebBrowser.openBrowserAsync(url).catch(() => undefined)}
      style={styles.link}
    >
      <AccessibleText variant="body" color={colors.primaryStrong} style={styles.linkText}>
        {label}
      </AccessibleText>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.sm,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.primary,
  },
  tickLabel: {
    flex: 1,
  },
  links: {
    gap: spacing.xs,
  },
  link: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
}));
