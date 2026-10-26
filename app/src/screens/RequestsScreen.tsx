import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { SignInNotice } from '../components/SignInNotice';
import { ChevronRightIcon } from '../components/icons';
import { getMyRequests, type RequestStatus, type RequestSummary } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import type { Poi } from '../api/types';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';
import { requestTypeKey } from '../utils/requestTypes';

type Props = {
  poi: Poi;
  onNew: () => void;
  onOpen: (id: string) => void;
  onSignIn: () => void;
};

// Closed requests read quieter than the ones still moving.
export function statusColor(status: RequestStatus): string {
  if (status === 'cancelled' || status === 'completed') return colors.textMuted;
  return colors.primaryStrong;
}

/**
 * A member's requests to the office: a baptism, a wedding, a certificate,
 * a word with the priest. Each one is followed here until it is done,
 * with the office's replies and the papers it asks for. Needs an account,
 * since the office has to know who to answer.
 */
export function RequestsScreen({ poi, onNew, onOpen, onSignIn }: Props) {
  const { t, language } = useI18n();
  const { me } = useAuth();
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    getMyRequests(poi.id)
      .then((result) => {
        if (!cancelled) setRequests(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [poi.id, me]);

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('requests.title')}</AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t(poi.type === 'church' ? 'requests.subtitle' : 'requests.subtitleGeneral')}
        </AccessibleText>
      </View>

      {!me ? (
        <SignInNotice onSignIn={onSignIn} />
      ) : (
        <>
          <AccessibleButton label={t('requests.newButton')} onPress={onNew} />

          {error && (
            <AccessibleText variant="body" color={colors.danger}>
              {t('requests.error')}
            </AccessibleText>
          )}
          {!error && requests === null && (
            <AccessibleText variant="body" color={colors.textMuted}>
              {t('common.loading')}
            </AccessibleText>
          )}
          {requests?.length === 0 && (
            <AccessibleText variant="body" color={colors.textMuted}>
              {t('requests.empty')}
            </AccessibleText>
          )}

          {requests?.map((request) => {
            const type = t(requestTypeKey(request.type, poi.type));
            const status = t(`requests.status_${request.status}`);
            const sent = t('requests.sentOn', {
              date: new Date(request.createdAt).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long' }),
            });
            const notes = [
              request.unread ? t('requests.unread') : null,
              request.documentsPending > 0
                ? t(request.documentsPending === 1 ? 'requests.documentsPendingOne' : 'requests.documentsPendingMany', {
                    count: request.documentsPending,
                  })
                : null,
            ].filter(Boolean);
            return (
              <Pressable
                key={request.id}
                accessibilityRole="button"
                accessibilityLabel={[type, status, ...notes].join('. ')}
                onPress={() => onOpen(request.id)}
                style={styles.card}
              >
                <View style={styles.cardText}>
                  <AccessibleText variant="bodyLarge" style={styles.cardTitle}>
                    {type}
                  </AccessibleText>
                  <AccessibleText variant="body" color={statusColor(request.status)} style={styles.status}>
                    {status}
                  </AccessibleText>
                  <AccessibleText variant="caption">{sent}</AccessibleText>
                  {notes.map((note) => (
                    <View key={note} style={styles.noteRow}>
                      <View style={styles.dot} />
                      <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.note}>
                        {note}
                      </AccessibleText>
                    </View>
                  ))}
                </View>
                <ChevronRightIcon size={22} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </>
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
    gap: spacing.md,
    ...cardSurface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontWeight: '700',
  },
  status: {
    fontWeight: '700',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  note: {
    fontWeight: '700',
  },
}));
