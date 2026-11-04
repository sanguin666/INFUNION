import { Fragment, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { AccessibleText } from '../components/AccessibleText';
import { groupByDay, SummaryDay, SummaryList, SummaryRow } from '../components/SummaryList';
import { PlusIcon } from '../components/icons';
import { getAnnouncements } from '../api/announcements';
import { uploadUri } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import type { Announcement, Poi } from '../api/types';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';
import { formatNewsDate, ImportantLabel } from './AnnouncementScreen';
import { TranslateLine } from '../components/TranslateLine';
import { useTranslations, type TranslationsHandle } from '../translation/useTranslations';

type Props = {
  poi: Poi;
  onCompose: () => void;
  onOpen: (item: Announcement) => void;
  // Announcements are the community speaking to its members, so only staff
  // get the compose button. See the backend's announcements controller.
  canCompose: boolean;
};

// A post this recent is flagged "New" above its title.
const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The News tab: the newest post big, with its photo and the start of its
 * text, then every earlier one under the day it was posted, in one white
 * box — the same list as the Events tab's coming events. Any post opens its own page.
 */
export function AnnouncementsScreen({ poi, onCompose, onOpen, canCompose }: Props) {
  const { t } = useI18n();
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAnnouncements(poi.id)
      .then((result) => {
        if (!cancelled) setAnnouncements(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [poi.id]);

  const [latest, ...earlier] = announcements ?? [];
  const tr = useTranslations(poi, 'announcement', (announcements ?? []).map((a) => a.id));

  return (
    <>
      <View style={styles.headerRow}>
        <AccessibleText variant="title" style={styles.title} accessibilityRole="header">
          {t('announcements.title')}
        </AccessibleText>
        {canCompose && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('announcements.newAria')}
            onPress={onCompose}
            style={styles.iconButton}
          >
            <PlusIcon size={20} color={colors.text} />
          </Pressable>
        )}
      </View>

      {error && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('announcements.error')}
        </AccessibleText>
      )}

      {!error && announcements === null && (
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('announcements.loading')}
        </AccessibleText>
      )}

      {announcements?.length === 0 && (
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('announcements.empty')}
        </AccessibleText>
      )}

      {latest && <LatestPost item={latest} tr={tr} onPress={() => onOpen(latest)} />}

      {earlier.length > 0 && (
        <>
          <AccessibleText variant="caption" style={styles.sectionLabel}>
            {t('announcements.earlier')}
          </AccessibleText>
          <PostList items={earlier} tr={tr} onOpen={onOpen} />
        </>
      )}
    </>
  );
}

function LatestPost({ item, tr, onPress }: { item: Announcement; tr: TranslationsHandle; onPress: () => void }) {
  const { t } = useI18n();
  const title = tr.text(item.id, 'title', item.title);
  const body = tr.text(item.id, 'body', item.body);
  const isNew = Date.now() - new Date(item.createdAt).getTime() < NEW_FOR_MS;
  const date = formatNewsDate(item.createdAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${date}`}
      accessibilityHint={t('announcements.readMore')}
      onPress={onPress}
      style={styles.latestCard}
    >
      {item.imageUrl ? (
        <Image source={{ uri: uploadUri(item.imageUrl) }} style={styles.latestPhoto} resizeMode="cover" />
      ) : null}
      <View style={styles.latestText}>
        <View style={styles.metaRow}>
          {item.important && <ImportantLabel />}
          <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.meta}>
            {isNew ? `${t('announcements.new')} · ${date}` : date}
          </AccessibleText>
        </View>
        <AccessibleText variant="bodyLarge" style={styles.bold}>
          {title}
        </AccessibleText>
        {!!item.body && (
          <AccessibleText variant="body" color={colors.textMuted} numberOfLines={3}>
            {body}
          </AccessibleText>
        )}
        <TranslateLine handle={tr} id={item.id} />
        {!item.body && !!item.audioUrl && (
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('announcements.voiceMessage')}
          </AccessibleText>
        )}
        <AccessibleText variant="body" color={colors.primaryStrong} style={styles.bold}>
          {t('announcements.readMore')} ›
        </AccessibleText>
      </View>
    </Pressable>
  );
}

/**
 * Earlier posts on the News tab, grouped under the day they were posted
 * ("Hoy", "Ayer", "Lunes 28 sept") in one white box.
 */
export function PostList({
  items,
  tr,
  onOpen,
}: {
  items: Announcement[];
  tr?: TranslationsHandle;
  onOpen: (item: Announcement) => void;
}) {
  const { t } = useI18n();
  return (
    <SummaryList>
      {groupByDay(items, (item) => new Date(item.createdAt)).map((day, dayIndex) => (
        <Fragment key={day.date.toDateString()}>
          <SummaryDay date={day.date} first={dayIndex === 0} />
          {day.items.map((item) => (
            <SummaryRow
              key={item.id}
              title={tr ? tr.text(item.id, 'title', item.title) : item.title}
              above={item.important ? <ImportantLabel /> : null}
              detail={item.audioUrl ? t('announcements.voiceMessage') : null}
              imageUrl={item.imageUrl}
              accessibilityLabel={`${tr ? tr.text(item.id, 'title', item.title) : item.title}, ${formatNewsDate(item.createdAt)}`}
              onPress={() => onOpen(item)}
            />
          ))}
        </Fragment>
      ))}
    </SummaryList>
  );
}

const styles = themedStyles(() => ({
  bold: {
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    ...cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  latestCard: {
    ...cardSurface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  latestPhoto: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  latestText: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
  },
}));
