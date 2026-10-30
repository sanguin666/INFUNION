import { ImageBackground, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { HaloBackdrop } from '../components/HaloBackdrop';
import { LogoMark, Wordmark } from '../components/Logo';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, themedStyles } from '../theme/theme';

type Props = {
  onSignUp: () => void;
  onSignIn: () => void;
  // Only while the backend offers the demo account; absent, no button.
  onDemoSignIn?: () => void;
};

/**
 * The first thing anyone sees who is not signed in. Two doors, nothing
 * else: there is nothing to read here and nothing to get wrong.
 *
 * Both doors lead to the same email-or-phone-and-code screen — the backend makes
 * an account on the first code that verifies, so "sign up" and "sign in"
 * differ only in where somebody lands afterwards, and pressing the wrong
 * one costs nothing.
 *
 * During the demo a third door sits under them: straight into the demo
 * member's account, for showing the app without typing a number.
 */
export function OnboardingScreen({ onSignUp, onSignIn, onDemoSignIn }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    /* The illustration is the screen, edge to edge and under the status
       bar and the home indicator alike — hence ImageBackground as the
       root rather than a sized layer behind it, which is what left a
       band of nothing at the bottom.

       Nothing here is inset: the picture is sized against this view, so a
       padding on it would shrink the picture too and leave a strip of
       bare colour down one side. The margin the panel needs lives on the
       panel.

       The asset is the supplied illustration whole, not a crop of it. */
    <ImageBackground
      source={require('../../assets/onboarding-crowd.jpg')}
      resizeMode="cover"
      style={styles.root}
    >
      {/* The words and the buttons sit in a patch of white light rather
          than on the illustration, so nothing is ever read against a
          figure. */}
      <HaloBackdrop width={width} height={height} />

      <View
        style={[
          styles.panel,
          {
            marginTop: insets.top + spacing.lg,
            marginBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <LogoMark size={104} />
        <View style={styles.wordmark}>
          <Wordmark height={72} />
        </View>
        <AccessibleText variant="bodyLarge" color={colors.textMuted} style={styles.welcome}>
          {t('onboarding.welcome')}
        </AccessibleText>

        <View style={styles.buttons}>
          <AccessibleButton label={t('onboarding.signUp')} onPress={onSignUp} />
          <AccessibleButton label={t('onboarding.signIn')} variant="secondary" onPress={onSignIn} />
          {onDemoSignIn && (
            <AccessibleButton label={t('onboarding.demoSignIn')} variant="secondary" onPress={onDemoSignIn} />
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
    justifyContent: 'center',
    // Shows only for the instant before the picture decodes.
    backgroundColor: colors.background,
  },
  panel: {
    // No background and no border: the light behind it is what separates
    // these words from the crowd now.
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    marginTop: spacing.xs,
  },
  // The tagline gets the panel's full width, out to its padding, so it
  // stays on one line in every language.
  welcome: {
    textAlign: 'center',
    alignSelf: 'stretch',
    marginHorizontal: -spacing.lg,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
}));
