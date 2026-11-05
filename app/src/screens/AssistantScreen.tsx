import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { FormCard, FormField } from '../components/FormCard';
import { SparkleIcon } from '../components/icons';
import { askAssistant, type AssistantAction } from '../api/assistant';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import type { Translations } from '../i18n/translations';
import type { Poi } from '../api/types';
import { cardSurface, colors, radii, spacing, themedStyles } from '../theme/theme';

export type AssistantItem = { role: 'member' | 'assistant'; text: string; actions?: AssistantAction[] };

type GoKey = Extract<keyof Translations['assistant'], `go_${string}`>;

type Props = {
  poi: Poi;
  // Kept by the hub, so a button to another screen and back keeps the
  // conversation.
  items: AssistantItem[];
  onItems: (items: AssistantItem[]) => void;
  remaining: number | null;
  onRemaining: (remaining: number) => void;
  onGo: (action: AssistantAction) => void;
};

// The turns sent with each question: enough to follow up, little to pay for.
const CONTEXT_TURNS = 8;
// From this many questions left, the member is told how many.
const SHOW_LEFT = 5;

/**
 * The member assistant (Seb, 5 Nov 2026, #136): a question about the
 * community, a short answer in the member's language from what the
 * community published, and buttons to the screens that do the rest.
 */
export function AssistantScreen({ poi, items, onItems, remaining, onRemaining, onGo }: Props) {
  const { t, language } = useI18n();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'limit' | null>(remaining === 0 ? 'limit' : null);

  async function ask() {
    const text = question.trim();
    if (!text || busy) return;
    const asked: AssistantItem[] = [...items, { role: 'member', text }];
    onItems(asked);
    setQuestion('');
    setBusy(true);
    setError(null);
    try {
      const reply = await askAssistant(poi.id, {
        turns: asked.slice(-CONTEXT_TURNS).map(({ role, text: said }) => ({ role, text: said })),
        language,
      });
      onItems([...asked, { role: 'assistant', text: reply.answer, actions: reply.actions }]);
      onRemaining(reply.remaining);
    } catch (caught) {
      // The question stays in the field, to ask again.
      onItems(items);
      setQuestion(text);
      if (caught instanceof ApiError && caught.status === 429) {
        onRemaining(0);
        setError('limit');
      } else {
        setError('error');
      }
    } finally {
      setBusy(false);
    }
  }

  const label = (action: AssistantAction) => {
    const key = `go_${action}` as GoKey;
    return t(`assistant.${key}`);
  };

  return (
    <>
      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <View style={styles.spark}>
            <SparkleIcon size={24} color={colors.primary} />
          </View>
          <AccessibleText variant="title" style={styles.flex}>
            {t('assistant.title', { name: poi.name })}
          </AccessibleText>
        </View>
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('assistant.subtitle')}
        </AccessibleText>
      </View>

      {items.length === 0 && <AccessibleText variant="body">{t('assistant.intro', { name: poi.name })}</AccessibleText>}

      {items.map((item, index) => (
        <View key={index} style={[styles.bubble, item.role === 'member' ? styles.mine : styles.theirs]}>
          <AccessibleText variant="body">{item.text}</AccessibleText>
          {item.actions?.map((action) => (
            <Pressable
              key={action}
              accessibilityRole="link"
              accessibilityLabel={label(action)}
              onPress={() => onGo(action)}
              style={styles.go}
            >
              <AccessibleText variant="body" color={colors.primaryStrong} style={styles.bold}>
                {label(action)} ›
              </AccessibleText>
            </Pressable>
          ))}
        </View>
      ))}

      {busy && (
        <View style={[styles.bubble, styles.theirs]}>
          <AccessibleText variant="body" color={colors.textMuted}>
            {t('assistant.thinking')}
          </AccessibleText>
        </View>
      )}

      {error && (
        <AccessibleText variant="body" color={error === 'limit' ? colors.text : colors.danger}>
          {t(error === 'limit' ? 'assistant.limit' : 'assistant.error')}
        </AccessibleText>
      )}

      {error !== 'limit' && (
        <>
          <FormCard>
            <FormField
              label={t('assistant.inputLabel')}
              value={question}
              onChangeText={setQuestion}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={ask}
              autoFocus={items.length === 0}
            />
          </FormCard>
          <AccessibleButton
            label={busy ? t('assistant.thinking') : t('assistant.send')}
            onPress={ask}
            disabled={busy || !question.trim()}
          />
        </>
      )}

      <AccessibleText variant="caption" color={colors.textMuted} style={styles.note}>
        {t('assistant.note')}
        {remaining !== null && remaining > 0 && remaining <= SHOW_LEFT ? ` ${t('assistant.left', { n: remaining })}` : ''}
      </AccessibleText>
    </>
  );
}

const styles = themedStyles(() => ({
  titleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  spark: {
    paddingTop: 6,
  },
  flex: {
    flex: 1,
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
  // The answer on white on the left, the member's question on the
  // purple wash on the right, as in Messages.
  theirs: {
    ...cardSurface,
    alignSelf: 'flex-start',
  },
  mine: {
    backgroundColor: colors.primarySoft,
    alignSelf: 'flex-end',
  },
  go: {
    paddingTop: spacing.xs,
    minHeight: 32,
    justifyContent: 'center',
  },
  note: {
    textAlign: 'center',
  },
}));
