import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { FormCard, FormField } from '../components/FormCard';
import { SignInNotice } from '../components/SignInNotice';
import { getMyMessages, sendMyMessage, type MemberMessage } from '../api/messages';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { Poi } from '../api/types';
import { formatWhen } from '../utils/schedule';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';

type Props = {
  poi: Poi;
  onSignIn: () => void;
  // Called once the office's messages have been read here, so the dot
  // on the menu goes out.
  onRead?: () => void;
};

// How often an open conversation checks for the office's answer.
const REFRESH_MS = 15_000;

/**
 * Messages (Seb, 25 Oct 2026): the member's conversation with the place's
 * office, which writes to them in particular from the dashboard. The
 * member reads it here and answers, the way they follow a request.
 */
export function MessagesScreen({ poi, onSignIn, onRead }: Props) {
  const { t, language } = useI18n();
  const { me } = useAuth();
  const [messages, setMessages] = useState<MemberMessage[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  const load = useCallback(() => {
    getMyMessages(poi.id)
      .then((list) => {
        setMessages(list);
        setLoadFailed(false);
        onRead?.();
      })
      .catch(() => setLoadFailed(true));
  }, [poi.id]);

  useEffect(() => {
    if (!me) return;
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, me]);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    setSendFailed(false);
    try {
      setMessages(await sendMyMessage(poi.id, message.trim()));
      setMessage('');
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

  const now = new Date();
  const when = (iso: string) =>
    formatWhen(new Date(iso), now, language, { today: t('schedule.today'), tomorrow: t('schedule.tomorrow') });

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t('messages.title')}</AccessibleText>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('messages.subtitle', { name: poi.name })}
        </AccessibleText>
      </View>

      {!me ? (
        <SignInNotice onSignIn={onSignIn} />
      ) : (
        <>
          {loadFailed && messages === null && (
            <AccessibleText variant="body" color={colors.danger}>
              {t('messages.loadError')}
            </AccessibleText>
          )}
          {!loadFailed && messages === null && (
            <AccessibleText variant="body" color={colors.textMuted}>
              {t('common.loading')}
            </AccessibleText>
          )}
          {messages?.length === 0 && (
            <AccessibleText variant="body" color={colors.textMuted}>
              {t('messages.empty')}
            </AccessibleText>
          )}
          {messages?.map((item) => (
            <View key={item.id} style={[styles.bubble, item.fromStaff ? styles.bubbleOffice : styles.bubbleMine]}>
              <AccessibleText variant="caption" style={styles.bold}>
                {item.fromStaff ? item.authorName || t('messages.office') : t('messages.you')} · {when(item.createdAt)}
              </AccessibleText>
              <AccessibleText variant="body">{item.body}</AccessibleText>
            </View>
          ))}

          {messages !== null && (
            <>
              <FormCard>
                <FormField
                  label={t('messages.writeLabel')}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  tall
                  maxLength={4000}
                />
              </FormCard>
              <AccessibleButton
                label={sending ? t('messages.sending') : t('messages.send')}
                onPress={send}
                disabled={sending || !message.trim()}
              />
              {sendFailed && (
                <AccessibleText variant="body" color={colors.danger}>
                  {t('messages.sendError')}
                </AccessibleText>
              )}
            </>
          )}
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
  bold: {
    fontWeight: '700',
  },
  bubble: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    maxWidth: '88%',
  },
  // The office on white on the left, the member's own words on the coral
  // wash on the right, as in a request's conversation.
  bubbleOffice: {
    ...cardSurface,
    alignSelf: 'flex-start',
  },
  bubbleMine: {
    backgroundColor: colors.primarySoft,
    alignSelf: 'flex-end',
  },
}));
