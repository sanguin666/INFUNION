import { type ReactNode, useEffect, useRef } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, themedStyles } from '../theme/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  // A bar pinned above the content — e.g. the hub's POI banner. It is the
  // only thing allowed into the top inset: `headerStyle`'s background is
  // painted edge to edge behind the status bar / camera cutout, while
  // everything the bar renders is pushed below them.
  header?: ReactNode;
  headerStyle?: StyleProp<ViewStyle>;
  // A bar pinned below the content — e.g. the hub's module tab bar. Same
  // deal at the bottom, for the home indicator / gesture bar.
  footer?: ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  // Changes when what the screen shows changes (a tab, a page opened from
  // a list): the scroll goes back to the top, rather than opening the new
  // page halfway down.
  scrollKey?: string;
  // Changes when the page grows at its end, as a conversation does: the
  // scroll follows it down.
  scrollEndKey?: number;
};

/**
 * Standard wrapper for every screen: high-contrast background, generous
 * margins, and safe-area handling.
 *
 * Safe areas are computed with react-native-safe-area-context rather than
 * React Native's own SafeAreaView, which is iOS-only — on Android it is a
 * plain View, so the banners ran under the camera cutout and the gesture
 * bar. Android has been edge-to-edge by default since SDK 54, so these
 * insets are the only thing keeping content clear of the system UI, on
 * every edge of every screen.
 */
export function Screen({
  children,
  scroll = false,
  header,
  headerStyle,
  footer,
  footerStyle,
  scrollKey,
  scrollEndKey,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);
  useEffect(() => {
    if (!scrollEndKey) return;
    // Once the new content is laid out.
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [scrollEndKey]);
  const insets = useSafeAreaInsets();

  // Whichever element touches an edge absorbs that edge's inset: a bar if
  // there is one, the content itself otherwise.
  const contentInsets = {
    paddingTop: (header ? 0 : insets.top) + spacing.lg,
    paddingBottom: (footer ? 0 : insets.bottom) + spacing.lg,
    paddingLeft: insets.left + spacing.lg,
    paddingRight: insets.right + spacing.lg,
  };

  const Content = scroll ? ScrollView : View;
  const contentProps = scroll
    ? {
        contentContainerStyle: [styles.content, contentInsets],
        style: styles.scrollFlex,
        ref: scrollRef,
      }
    : { style: [styles.content, contentInsets] };

  return (
    <View style={styles.root}>
      {header && (
        <View
          style={[
            { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
            headerStyle,
          ]}
        >
          {header}
        </View>
      )}

      <Content {...contentProps}>{children}</Content>

      {footer && (
        <View
          style={[
            { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
            footerStyle,
          ]}
        >
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollFlex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
  },
}));
