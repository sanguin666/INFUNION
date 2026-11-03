import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { FormCard, FormDivider, FormField } from '../components/FormCard';
import { ChatBubbleIcon, ChevronRightIcon } from '../components/icons';
import { createCommunityPost, getCommunityPosts } from '../api/community';
import { SignInNotice } from '../components/SignInNotice';
import { ContentMenu, ReportedNotice } from '../components/ContentMenu';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { CommunityPost, Poi } from '../api/types';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  poi: Poi;
  onOpenPost: (post: CommunityPost) => void;
  onSignIn: () => void;
};

export function CommunityScreen({ poi, onOpenPost, onSignIn }: Props) {
  const { t } = useI18n();
  const { me } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // Reported in this visit: shown as hidden until the list loads again,
  // after which the backend leaves them out.
  const [reported, setReported] = useState<Set<string>>(new Set());

  function load() {
    getCommunityPosts(poi.id)
      .then(setPosts)
      .catch(() => setError(true));
  }

  useEffect(load, [poi.id]);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const created = await createCommunityPost(poi.id, {
        message: message.trim(),
        authorName: authorName.trim() || undefined,
      });
      setPosts((current) => [created, ...(current ?? [])]);
      setMessage('');
      setAuthorName('');
    } catch (e) {
      if (e instanceof ApiError && e.message === 'posting_blocked') setBlocked(true);
      else setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('community.title')}</AccessibleText>
      </View>

      {me ? (
        <>
          <FormCard>
              <FormField
                label={t('community.messagePlaceholder')}
                value={message}
                onChangeText={setMessage}
                multiline
                tall
              />
              <FormDivider />
              <FormField
                label={t('community.namePlaceholder')}
                value={authorName}
                onChangeText={setAuthorName}
              />
            </FormCard>

            <AccessibleButton
              label={submitting ? t('community.postingButton') : t('community.postButton')}
              onPress={submit}
              disabled={submitting || !message.trim()}
            />
        </>
      ) : (
        <SignInNotice onSignIn={onSignIn} />
      )}

      {blocked && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('moderation.blocked')}
        </AccessibleText>
      )}

      {error && (
        <AccessibleText variant="body" color={colors.danger}>
          {t('community.error')}
        </AccessibleText>
      )}

      {!error && posts === null && (
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('community.loading')}
        </AccessibleText>
      )}

      {posts?.map((item) =>
        reported.has(item.id) ? (
          <ReportedNotice key={item.id} />
        ) : (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={t('community.openAria', { message: item.message })}
          onPress={() => onOpenPost(item)}
          style={styles.card}
        >
          <View style={styles.cardBody}>
            <AccessibleText variant="body">{item.message}</AccessibleText>
            <View style={styles.cardFooter}>
              <AccessibleText variant="caption">— {item.authorName ?? t('common.anonymous')}</AccessibleText>
              <View style={styles.commentCount}>
                <ChatBubbleIcon size={16} color={colors.primary} />
                <AccessibleText variant="caption" color={colors.primary} style={styles.commentCountLabel}>
                  {item.commentCount}
                </AccessibleText>
                <ContentMenu
                  poiId={poi.id}
                  kind="post"
                  targetId={item.id}
                  authorName={item.authorName}
                  onReported={() => setReported((current) => new Set(current).add(item.id))}
                  onHidden={load}
                />
              </View>
            </View>
          </View>
          <ChevronRightIcon size={20} color={colors.textMuted} />
        </Pressable>
        ),
      )}
    </>
  );
}

const styles = themedStyles(() => ({
  titleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...cardSurface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  cardBody: {
    flex: 1,
    gap: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commentCountLabel: {
    fontWeight: '700',
  },
}));
