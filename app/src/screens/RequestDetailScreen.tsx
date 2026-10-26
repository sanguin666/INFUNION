import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { FormCard, FormDivider, FormField } from '../components/FormCard';
import { CheckIcon, CloseIcon, DocumentIcon, PaperclipIcon } from '../components/icons';
import { uploadUri } from '../api/client';
import type { PickedFile } from '../api/files';
import {
  cancelMyRequest,
  getMyRequest,
  sendRequestMessage,
  uploadRequestDocument,
  type RequestDetail,
  type RequestDocument,
  type RequestFile,
} from '../api/requests';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import type { Poi } from '../api/types';
import { formatWhen } from '../utils/schedule';
import { cardSurface, colors, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import { statusColor } from './RequestsScreen';
import { requestTypeKey } from '../utils/requestTypes';

type Props = {
  poi: Poi;
  requestId: string;
};

// How often an open request checks for the office's answer.
const REFRESH_MS = 15_000;

type Source = 'camera' | 'library';

/**
 * One request, as the member follows it: where it stands, the appointment
 * once there is one, the papers the office asked for (each sent as a
 * photo from the phone), and the conversation with the office.
 */
export function RequestDetailScreen({ poi, requestId }: Props) {
  const { t, language } = useI18n();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The paper whose photo is being chosen or sent.
  const [choosingFor, setChoosingFor] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    getMyRequest(poi.id, requestId)
      .then(setRequest)
      .catch(() => setLoadFailed(true));
  }, [poi.id, requestId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function pick(source: Source): Promise<PickedFile | null> {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('requests.permissionDenied'));
      return null;
    }
    // A paper has to stay readable: no cropping, and a quality that keeps
    // small print sharp while staying well under the 10 MB limit.
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return null;
    return { uri: asset.uri, name: asset.fileName ?? null, mimeType: asset.mimeType ?? null };
  }

  async function sendDocument(document: RequestDocument, source: Source) {
    setError(null);
    const file = await pick(source);
    if (!file) return;
    setChoosingFor(null);
    setUploadingFor(document.id);
    try {
      setRequest(await uploadRequestDocument(poi.id, requestId, document.id, file));
    } catch {
      setError(t('requests.actionError'));
    } finally {
      setUploadingFor(null);
    }
  }

  async function attach() {
    setError(null);
    const file = await pick('library');
    if (file) setAttachment(file);
  }

  async function send() {
    if (!message.trim() && !attachment) return;
    setSending(true);
    setError(null);
    try {
      setRequest(await sendRequestMessage(poi.id, requestId, message.trim(), attachment));
      setMessage('');
      setAttachment(null);
    } catch {
      setError(t('requests.actionError'));
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    setCancelling(true);
    setError(null);
    try {
      setRequest(await cancelMyRequest(poi.id, requestId));
      setConfirmingCancel(false);
    } catch {
      setError(t('requests.actionError'));
    } finally {
      setCancelling(false);
    }
  }

  function openFile(file: RequestFile) {
    WebBrowser.openBrowserAsync(uploadUri(file.url)).catch(() => setError(t('requests.actionError')));
  }

  if (!request) {
    return (
      <AccessibleText variant="body" color={loadFailed ? colors.danger : colors.textMuted}>
        {loadFailed ? t('requests.error') : t('common.loading')}
      </AccessibleText>
    );
  }

  const closed = request.status === 'completed' || request.status === 'cancelled';
  const now = new Date();
  const when = (iso: string) =>
    formatWhen(new Date(iso), now, language, { today: t('schedule.today'), tomorrow: t('schedule.tomorrow') });

  return (
    <>
      <View style={styles.titleBlock}>
        <AccessibleText variant="title">{t(requestTypeKey(request.type, poi.type))}</AccessibleText>
        <AccessibleText variant="bodyLarge" color={statusColor(request.status)} style={styles.bold}>
          {t(`requests.status_${request.status}`)}
        </AccessibleText>
      </View>

      {request.appointmentAt && request.status !== 'cancelled' && (
        <View style={styles.card}>
          <AccessibleText variant="caption" color={colors.primaryStrong} style={styles.cardLabel}>
            {t('requests.appointment')}
          </AccessibleText>
          <AccessibleText variant="bodyLarge" style={styles.bold}>
            {when(request.appointmentAt)}
          </AccessibleText>
          {!!request.appointmentPlace && (
            <AccessibleText variant="body" color={colors.textMuted}>
              {request.appointmentPlace}
            </AccessibleText>
          )}
        </View>
      )}

      {request.documents.length > 0 && (
        <>
          <AccessibleText variant="caption" style={styles.sectionLabel}>
            {t('requests.documents')}
          </AccessibleText>
          <View style={styles.listCard}>
            {request.documents.map((document, index) => {
              const state = document.receivedAt ? 'received' : document.file ? 'sent' : 'pending';
              return (
                <View key={document.id} style={[styles.documentRow, index > 0 && styles.rowDivider]}>
                  <View style={styles.documentHeader}>
                    {state === 'received' ? (
                      <CheckIcon size={24} color={colors.primaryStrong} />
                    ) : (
                      <DocumentIcon size={24} color={state === 'pending' ? colors.primaryStrong : colors.textMuted} />
                    )}
                    <View style={styles.flex}>
                      <AccessibleText variant="body" style={styles.bold}>
                        {document.label}
                      </AccessibleText>
                      <AccessibleText
                        variant="caption"
                        color={state === 'pending' ? colors.primaryStrong : colors.textMuted}
                        style={state === 'pending' ? styles.bold : undefined}
                      >
                        {t(`requests.doc_${state}`)}
                      </AccessibleText>
                    </View>
                  </View>
                  {!!document.note && (
                    <AccessibleText variant="body" color={colors.textMuted}>
                      {document.note}
                    </AccessibleText>
                  )}
                  {document.file && (
                    <FileLink file={document.file} onOpen={openFile} label={t('requests.openFile', { name: document.file.name })} />
                  )}
                  {state !== 'received' && !closed &&
                    (uploadingFor === document.id ? (
                      <View style={styles.waiting}>
                        <ActivityIndicator color={colors.primary} />
                        <AccessibleText variant="body" color={colors.textMuted}>
                          {t('requests.sending')}
                        </AccessibleText>
                      </View>
                    ) : choosingFor === document.id ? (
                      <View style={styles.choices}>
                        <AccessibleButton label={t('requests.takePhoto')} onPress={() => sendDocument(document, 'camera')} />
                        <AccessibleButton label={t('requests.choosePhoto')} onPress={() => sendDocument(document, 'library')} />
                        <AccessibleButton
                          variant="secondary"
                          label={t('requests.cancelChoice')}
                          onPress={() => setChoosingFor(null)}
                        />
                      </View>
                    ) : (
                      <AccessibleButton
                        variant={state === 'pending' ? 'primary' : 'secondary'}
                        label={state === 'pending' ? t('requests.sendPhoto') : t('requests.sendAnother')}
                        onPress={() => setChoosingFor(document.id)}
                      />
                    ))}
                </View>
              );
            })}
          </View>
        </>
      )}

      <AccessibleText variant="caption" style={styles.sectionLabel}>
        {t('requests.yourRequest')}
      </AccessibleText>
      <View style={styles.card}>
        <AccessibleText variant="body">{request.details}</AccessibleText>
        {!!request.preferredDate && (
          <AccessibleText variant="caption">
            {t('requests.preferredDate', { date: request.preferredDate })}
          </AccessibleText>
        )}
        <AccessibleText variant="caption">
          {t('requests.sentOn', {
            date: new Date(request.createdAt).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long' }),
          })}
        </AccessibleText>
      </View>

      <AccessibleText variant="caption" style={styles.sectionLabel}>
        {t('requests.messages')}
      </AccessibleText>
      {request.messages.length === 0 && (
        <AccessibleText variant="body" color={colors.textMuted}>
          {t('requests.noMessages')}
        </AccessibleText>
      )}
      {request.messages.map((item) => (
        <View
          key={item.id}
          style={[styles.bubble, item.fromStaff ? styles.bubbleOffice : styles.bubbleMine]}
        >
          <AccessibleText variant="caption" style={styles.bold}>
            {item.fromStaff ? item.authorName || t('requests.office') : t('requests.you')} · {when(item.createdAt)}
          </AccessibleText>
          {!!item.body && <AccessibleText variant="body">{item.body}</AccessibleText>}
          {item.attachment && (
            <FileLink
              file={item.attachment}
              onOpen={openFile}
              label={t('requests.openFile', { name: item.attachment.name })}
            />
          )}
        </View>
      ))}

      {!closed && (
        <>
          <FormCard>
            <FormField
              label={t('requests.messageLabel')}
              value={message}
              onChangeText={setMessage}
              multiline
              tall
            />
            <FormDivider />
            {attachment ? (
              <View style={styles.attachmentRow}>
                <PaperclipIcon size={22} color={colors.textMuted} />
                <AccessibleText variant="body" numberOfLines={1} style={styles.flex}>
                  {attachment.name ?? t('requests.photo')}
                </AccessibleText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('requests.removeAttachment')}
                  onPress={() => setAttachment(null)}
                  style={styles.iconButton}
                >
                  <CloseIcon size={22} color={colors.text} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('requests.attach')}
                onPress={attach}
                style={styles.attachmentRow}
              >
                <PaperclipIcon size={22} color={colors.primaryStrong} />
                <AccessibleText variant="body" color={colors.primaryStrong} style={styles.bold}>
                  {t('requests.attach')}
                </AccessibleText>
              </Pressable>
            )}
          </FormCard>
          <AccessibleButton
            label={sending ? t('requests.sending') : t('requests.sendMessage')}
            onPress={send}
            disabled={sending || (!message.trim() && !attachment)}
          />
        </>
      )}

      {error && (
        <AccessibleText variant="body" color={colors.danger}>
          {error}
        </AccessibleText>
      )}

      {!closed &&
        (confirmingCancel ? (
          <View style={styles.card}>
            <AccessibleText variant="bodyLarge" style={styles.bold}>
              {t('requests.cancelQuestion')}
            </AccessibleText>
            <AccessibleButton
              label={cancelling ? t('requests.sending') : t('requests.cancelConfirm')}
              onPress={cancel}
              disabled={cancelling}
            />
            <AccessibleButton
              variant="secondary"
              label={t('requests.cancelKeep')}
              onPress={() => setConfirmingCancel(false)}
            />
          </View>
        ) : (
          <AccessibleButton
            variant="destructive"
            label={t('requests.cancelRequest')}
            onPress={() => setConfirmingCancel(true)}
          />
        ))}
    </>
  );
}

function FileLink({ file, onOpen, label }: { file: RequestFile; onOpen: (file: RequestFile) => void; label: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => onOpen(file)} style={styles.fileLink}>
      <PaperclipIcon size={20} color={colors.primaryStrong} />
      <AccessibleText variant="body" color={colors.primaryStrong} numberOfLines={1} style={[styles.flex, styles.underline]}>
        {file.name}
      </AccessibleText>
    </Pressable>
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
  flex: {
    flex: 1,
  },
  sectionLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  card: {
    ...cardSurface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  listCard: {
    ...cardSurface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  documentRow: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  choices: {
    gap: spacing.sm,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  bubble: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    maxWidth: '88%',
  },
  // The office's words sit on white on the left; the member's own on the
  // coral wash on the right, the way every messaging app does it.
  bubbleOffice: {
    ...cardSurface,
    alignSelf: 'flex-start',
  },
  bubbleMine: {
    backgroundColor: colors.primarySoft,
    alignSelf: 'flex-end',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  underline: {
    textDecorationLine: 'underline',
  },
}));
