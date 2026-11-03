import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleButton } from './AccessibleButton';
import { AccessibleText } from './AccessibleText';
import { ChevronRightIcon, MoreDotsIcon } from './icons';
import { hidePerson, reportContent, type ReportKind, type ReportReason } from '../api/moderation';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';

const REASONS: { reason: ReportReason; key: 'reasonSpam' | 'reasonHateful' | 'reasonHarassment' | 'reasonInappropriate' | 'reasonOther' }[] = [
  { reason: 'spam', key: 'reasonSpam' },
  { reason: 'hateful', key: 'reasonHateful' },
  { reason: 'harassment', key: 'reasonHarassment' },
  { reason: 'inappropriate', key: 'reasonInappropriate' },
  { reason: 'other', key: 'reasonOther' },
];

const REPORT_KEY = { post: 'reportPost', comment: 'reportReply', prayer: 'reportPrayer' } as const;

type Props = {
  poiId: string;
  kind: ReportKind;
  targetId: string;
  authorName?: string | null;
  // The item is reported: the screen shows it as hidden for this member.
  onReported: () => void;
  // Its author is hidden: the screen loads its list again.
  onHidden: () => void;
};

/**
 * The "⋯" on a post, a reply or a prayer request: report it to the team,
 * or hide everything from the person who wrote it (Apple guideline 1.2).
 * Only for signed-in members, since both are remembered on the account.
 */
export function ContentMenu({ poiId, kind, targetId, authorName, onReported, onHidden }: Props) {
  const { t } = useI18n();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'closed' | 'menu' | 'report'>('closed');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;

  function close() {
    setStep('closed');
    setReason(null);
    setError(null);
  }

  async function send() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await reportContent(poiId, { kind, targetId, reason });
      close();
      onReported();
    } catch {
      setError(t('moderation.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function hide() {
    setBusy(true);
    setError(null);
    try {
      await hidePerson({ kind, targetId });
      close();
      onHidden();
    } catch (e) {
      const code = e instanceof ApiError ? e.message : '';
      setError(
        code === 'own_content'
          ? t('moderation.ownContent')
          : code === 'no_author'
            ? t('moderation.noAuthor')
            : t('moderation.failed'),
      );
    } finally {
      setBusy(false);
    }
  }

  const hideLabel = authorName
    ? t('moderation.hidePerson', { name: authorName })
    : t('moderation.hideAnonymous');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('moderation.menuAria')}
        hitSlop={spacing.sm}
        onPress={() => setStep('menu')}
        style={styles.dots}
      >
        <MoreDotsIcon size={20} color={colors.textMuted} />
      </Pressable>

      <Modal visible={step !== 'closed'} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.scrim} accessibilityLabel={t('moderation.cancel')} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          {step === 'menu' ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(`moderation.${REPORT_KEY[kind]}`)}
                onPress={() => setStep('report')}
                style={styles.row}
              >
                <AccessibleText variant="bodyLarge" style={styles.rowLabel}>
                  {t(`moderation.${REPORT_KEY[kind]}`)}
                </AccessibleText>
                <ChevronRightIcon size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={hideLabel}
                disabled={busy}
                onPress={() => void hide()}
                style={[styles.row, styles.rowDivider]}
              >
                <AccessibleText variant="bodyLarge" style={styles.rowLabel}>
                  {hideLabel}
                </AccessibleText>
              </Pressable>
            </>
          ) : (
            <>
              <AccessibleText variant="title" accessibilityRole="header">
                {t(`moderation.${REPORT_KEY[kind]}`)}
              </AccessibleText>
              <AccessibleText variant="body" color={colors.textMuted}>
                {t('moderation.reportHint')}
              </AccessibleText>
              <View>
                {REASONS.map((item, index) => {
                  const selected = reason === item.reason;
                  return (
                    <Pressable
                      key={item.reason}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={t(`moderation.${item.key}`)}
                      onPress={() => setReason(item.reason)}
                      style={[styles.row, index > 0 && styles.rowDivider]}
                    >
                      <AccessibleText variant="bodyLarge" style={styles.rowLabel}>
                        {t(`moderation.${item.key}`)}
                      </AccessibleText>
                      <View style={[styles.radio, selected && styles.radioOn]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <AccessibleButton
                label={busy ? t('moderation.sending') : t('moderation.send')}
                onPress={() => void send()}
                disabled={busy || !reason}
              />
            </>
          )}
          {error && (
            <AccessibleText variant="body" color={colors.danger}>
              {error}
            </AccessibleText>
          )}
          <AccessibleButton label={t('moderation.cancel')} variant="secondary" onPress={close} />
        </View>
      </Modal>
    </>
  );
}

/** Where a reported item was: hidden for this member, waiting for the team. */
export function ReportedNotice() {
  const { t } = useI18n();
  return (
    <View style={styles.notice}>
      <AccessibleText variant="body" color={colors.textMuted}>
        {t('moderation.reported')}
      </AccessibleText>
    </View>
  );
}

const styles = themedStyles(() => ({
  dots: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  rowLabel: {
    flex: 1,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  notice: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
}));
