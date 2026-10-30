import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { BackChevronIcon } from '../components/icons';
import { Lockup } from '../components/Logo';
import { requestLoginCode, verifyLoginCode } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { getLastLogin, storeLastLogin } from '../storage/session';
import { useI18n } from '../i18n/I18nContext';
import { ApiError } from '../api/client';
import { cardSurface, colors, fontSizes, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  onBack: () => void;
  onSignedIn: () => void;
};

/**
 * Signing in with an email address or a phone number, and a 6-digit code
 * sent there. No password: it is the single thing most likely to stop
 * someone using the app at all.
 *
 * One field for both, rather than a choice first: the backend tells an
 * email from a number by the @. Two steps on one screen rather than two
 * routes, so the address stays visible while the code is typed and "wrong
 * address" is a tap away.
 */
export function PhoneLoginScreen({ onBack, onSignedIn }: Props) {
  const { t, language } = useI18n();
  const { signIn } = useAuth();

  const [step, setStep] = useState<'login' | 'code'>('login');
  // An email address or a phone number, as typed.
  const [login, setLogin] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown only when the backend has nothing set up to send the code — it
  // hands it back so the flow can be completed on a development machine.
  const [devCode, setDevCode] = useState<string | null>(null);

  // Whoever signed in on this phone before finds their email or number
  // already filled in; anything typed meanwhile is left alone. Sign-in asks
  // for nothing else (Seb, 30 Oct 2026): the name is set later in the
  // profile.
  useEffect(() => {
    getLastLogin().then((last) => {
      if (!last) return;
      setLogin((current) => current || last.phone);
    });
  }, []);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const result = await requestLoginCode(login.trim(), language);
      // An older backend answers without a channel, and only sends SMS.
      setChannel(result.channel ?? 'sms');
      setDevCode(result.devCode ?? null);
      setStep('code');
      setCode('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('signIn.genericError'));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await verifyLoginCode(login.trim(), code.trim());
      await storeLastLogin({ phone: login.trim(), firstName: '' });
      await signIn(accessToken);
      onSignedIn();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('signIn.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
        style={styles.backButton}
      >
        <BackChevronIcon size={20} color={colors.text} />
        <AccessibleText variant="body">{t('common.back')}</AccessibleText>
      </Pressable>

      {/* The same infunion lockup as the next step (adding a place), so
          the whole way in looks like one app. */}
      <View style={styles.brand}>
        <Lockup height={48} />
      </View>

      <AccessibleText variant="title">{t('signIn.title')}</AccessibleText>

      {step === 'login' ? (
        <>
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('signIn.loginExplainer')}
          </AccessibleText>

          <AccessibleText variant="body">{t('signIn.loginLabel')}</AccessibleText>
          {/* The email keyboard has both the @ and the digits a number
              needs, so it serves either answer. */}
          <TextInput
            value={login}
            onChangeText={setLogin}
            placeholder={t('signIn.loginPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            style={styles.input}
          />


          {error && (
            <AccessibleText variant="body" color={colors.danger}>
              {error}
            </AccessibleText>
          )}

          <AccessibleButton
            label={busy ? t('signIn.sending') : t('signIn.sendCode')}
            onPress={sendCode}
            disabled={busy || login.trim().length < 6}
          />
        </>
      ) : (
        <>
          <AccessibleText variant="body" color={colors.textMuted}>
            {channel === 'email'
              ? t('signIn.codeExplainerEmail', { email: login.trim() })
              : t('signIn.codeExplainer', { phone: login.trim() })}
          </AccessibleText>

          {devCode && (
            <View style={styles.devCode}>
              <AccessibleText variant="caption" color={colors.textMuted}>
                {t('signIn.devCodeLabel')}
              </AccessibleText>
              <AccessibleText variant="bodyLarge">{devCode}</AccessibleText>
            </View>
          )}

          <TextInput
            value={code}
            onChangeText={(next) => setCode(next.replace(/[^0-9]/g, ''))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={[styles.input, styles.codeInput]}
          />

          {error && (
            <AccessibleText variant="body" color={colors.danger}>
              {error}
            </AccessibleText>
          )}

          <AccessibleButton
            label={busy ? t('signIn.checking') : t('signIn.confirm')}
            onPress={submitCode}
            disabled={busy || code.length !== 6}
          />

          <AccessibleButton
            label={t('signIn.changeLogin')}
            variant="secondary"
            onPress={() => {
              setStep('login');
              setError(null);
              setDevCode(null);
            }}
            disabled={busy}
          />
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 64,
    fontSize: fontSizes.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  // The code is short and typed from memory, so it gets the room to be
  // read back at a glance.
  codeInput: {
    fontSize: fontSizes.title,
    letterSpacing: 6,
    textAlign: 'center',
  },
  devCode: {
    ...cardSurface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
}));
