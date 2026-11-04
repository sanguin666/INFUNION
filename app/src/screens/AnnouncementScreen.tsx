import { Image, Pressable, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AccessibleText } from '../components/AccessibleText';
import { PlayIcon } from '../components/icons';
import { uploadUri } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import type { Announcement, Poi } from '../api/types';
import { TranslateLine } from '../components/TranslateLine';
import { useTranslations } from '../translation/useTranslations';
import { colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';

export function formatNewsDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "Important", white on the dark coral, as on the home page's messages. */
export function ImportantLabel() {
  const { t } = useI18n();
  return (
    <View style={styles.important}>
      <AccessibleText variant="caption" color={colors.primaryText} style={styles.importantText}>
        {t('announcements.important')}
      </AccessibleText>
    </View>
  );
}

/**
 * One news post on its own page, laid out like a donation project's:
 * the photo, the date and title, the whole text, and the voice message
 * when the office recorded one.
 */
export function AnnouncementScreen({ poi, item }: { poi: Poi; item: Announcement }) {
  const { t } = useI18n();
  const tr = useTranslations(poi, 'announcement', [item.id]);
  const long = new Date(item.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return (
    <>
      {item.imageUrl ? (
        <Image
          source={{ uri: uploadUri(item.imageUrl) }}
          style={styles.hero}
          resizeMode="cover"
          accessibilityLabel={item.title}
        />
      ) : null}
      <View style={styles.titleBlock}>
        <View style={styles.metaRow}>
          {item.important && <ImportantLabel />}
          <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.meta}>
            {long}
          </AccessibleText>
        </View>
        <AccessibleText variant="title" style={styles.title} accessibilityRole="header">
          {tr.text(item.id, 'title', item.title)}
        </AccessibleText>
      </View>
      {!!item.body && <AccessibleText variant="body">{tr.text(item.id, 'body', item.body)}</AccessibleText>}
      <TranslateLine handle={tr} id={item.id} />
      {!!item.audioUrl && <VoiceButton path={item.audioUrl} label={t('announcements.playVoice')} />}
    </>
  );
}

function VoiceButton({ path, label }: { path: string; label: string }) {
  const { t } = useI18n();
  const player = useAudioPlayer(uploadUri(path));
  const status = useAudioPlayerStatus(player);
  const text = status.playing ? t('announcements.pauseVoice') : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={() => (status.playing ? player.pause() : player.play())}
      style={styles.audioButton}
    >
      <PlayIcon size={18} color={colors.primaryText} />
      <AccessibleText variant="body" color={colors.primaryText} style={styles.bold}>
        {text}
      </AccessibleText>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  bold: {
    fontWeight: '700',
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
  },
  titleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  title: {
    fontSize: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    fontWeight: '700',
  },
  important: {
    backgroundColor: colors.primaryFill,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  importantText: {
    fontWeight: '700',
    fontSize: 14,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
  },
}));
