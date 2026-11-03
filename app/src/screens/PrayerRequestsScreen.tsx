import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccessibleText } from '../components/AccessibleText';
import { AccessibleButton } from '../components/AccessibleButton';
import { FormCard, FormDivider, FormField } from '../components/FormCard';
import { CandleIcon } from '../components/icons';
import { createPrayerRequest, getPrayerRequests, prayForRequest } from '../api/prayerRequests';
import { SignInNotice } from '../components/SignInNotice';
import { ContentMenu, ReportedNotice } from '../components/ContentMenu';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { PrayerRequest, Poi } from '../api/types';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  poi: Poi;
  onSignIn: () => void;
};

export function PrayerRequestsScreen({ poi, onSignIn }: Props) {
  const { t } = useI18n();
  const { me } = useAuth();
  const [requests, setRequests] = useState<PrayerRequest[] | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  function load() {
    getPrayerRequests(poi.id)
      .then(setRequests)
      .catch(() => setError(true));
  }

  useEffect(load, [poi.id]);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const created = await createPrayerRequest(poi.id, {
        message: message.trim(),
        authorName: authorName.trim() || undefined,
      });
      setRequests((current) => [created, ...(current ?? [])]);
      setMessage('');
      setAuthorName('');
    } catch (e) {
      if (e instanceof ApiError && e.message === 'posting_blocked') setBlocked(true);
      else setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function pray(id: string) {
    // The counter is behind a session too, so send them to sign in rather
    // than letting the tap fail silently.
    if (!me) {
      onSignIn();
      return;
    }
    try {
      const updated = await prayForRequest(poi.id, id);
      setRequests((current) => current?.map((r) => (r.id === id ? updated : r)) ?? null);
    } catch {
      // Non-critical — leave the count as-is if this single tap fails.
    }
  }

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('prayerRequests.title')}</AccessibleText>
      </View>

      {me ? (
        <>
          <FormCard>
              <FormField
                label={t('prayerRequests.messagePlaceholder')}
                value={message}
                onChangeText={setMessage}
                multiline
                tall
              />
              <FormDivider />
              <FormField
                label={t('prayerRequests.namePlaceholder')}
                value={authorName}
                onChangeText={setAuthorName}
              />
            </FormCard>

            <AccessibleButton
              label={submitting ? t('prayerRequests.sharingButton') : t('prayerRequests.shareButton')}
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
          {t('prayerRequests.error')}
        </AccessibleText>
      )}

      {!error && requests === null && (
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('prayerRequests.loading')}
        </AccessibleText>
      )}

      {requests?.map((item) =>
        reported.has(item.id) ? (
          <ReportedNotice key={item.id} />
        ) : (
        <View key={item.id} style={styles.card}>
          <AccessibleText variant="body">{item.message}</AccessibleText>
          <View style={styles.cardFooter}>
            <AccessibleText variant="caption" style={styles.byline}>
              — {item.authorName ?? t('common.anonymous')} · {item.prayerCount} {t('prayerRequests.prayingSuffix')}
            </AccessibleText>
            <ContentMenu
              poiId={poi.id}
              kind="prayer"
              targetId={item.id}
              authorName={item.authorName}
              onReported={() => setReported((current) => new Set(current).add(item.id))}
              onHidden={load}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('prayerRequests.prayAria')}
              onPress={() => pray(item.id)}
              style={styles.prayButton}
            >
              <CandleIcon size={16} color={colors.primaryText} />
              <AccessibleText variant="caption" color={colors.primaryText} style={styles.prayLabel}>
                {t('prayerRequests.prayButton')}
              </AccessibleText>
            </Pressable>
          </View>
        </View>
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
    ...cardSurface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  byline: {
    flex: 1,
  },
  prayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 9999,
    // A button is not a box: filled coral rather than a beige patch, so
    // nothing inside the white card reads as a second box.
    backgroundColor: colors.primary,
  },
  prayLabel: {
    fontWeight: '700',
  },
}));
