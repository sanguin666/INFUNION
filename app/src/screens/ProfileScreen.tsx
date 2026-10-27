import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleButton } from '../components/AccessibleButton';
import { AccessibleText } from '../components/AccessibleText';
import { Avatar } from '../components/Avatar';
import { FormCard, FormDivider, FormField, FormRow } from '../components/FormCard';
import { CameraIcon, CloseIcon } from '../components/icons';
import { deleteMyAccount, getMyDataLink, updateMyProfile, uploadMyAvatar } from '../api/auth';
import { ApiError, uploadUri } from '../api/client';
import { PRIVACY_URL, TERMS_URL } from '../legal';
import { useAuth } from '../auth/AuthContext';
import { cardSurface, colors, fontSizes, minTouchTarget, radii, spacing, themedStyles } from '../theme/theme';
import { useI18n } from '../i18n/I18nContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Signing in is a screen of its own, so the settings menu hands that
  // over rather than growing a second login form.
  onSignIn: () => void;
};

/**
 * What the profile circle in the hub's top bar opens: the two things
 * somebody can change about themselves today, a picture and a name, and
 * the way out of their session.
 *
 * A full-height sheet rather than a small one to drag up — every row is a
 * full-width target and the fields are the same size as everywhere else
 * in the app.
 */
export function ProfileScreen({ visible, onClose, onSignIn }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { me, applyMe, signOut } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState<'name' | 'picture' | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reopening starts from whatever the session says, so an abandoned edit
  // is never waiting there the next time.
  useEffect(() => {
    if (!visible) return;
    setFirstName(me?.firstName ?? '');
    setLastName(me?.lastName ?? '');
    setBusy(null);
    setSaved(false);
    setError(null);
    setPickerOpen(false);
  }, [visible, me]);

  /**
   * The copy of their data opens in the phone's browser, which downloads
   * it: a ten-minute signed link, since the browser has no session.
   */
  async function downloadMyData() {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(uploadUri(await getMyDataLink()));
    } catch {
      setError(t('privacy.downloadError'));
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      setConfirmingDelete(false);
      onClose();
      await signOut();
    } catch (failure) {
      setDeleteError(
        failure instanceof ApiError && failure.status === 409 ? t('privacy.deleteManager') : t('privacy.deleteError'),
      );
    } finally {
      setDeleting(false);
    }
  }

  const nameChanged =
    firstName.trim() !== (me?.firstName ?? '') || lastName.trim() !== (me?.lastName ?? '');

  async function saveName() {
    setBusy('name');
    setError(null);
    try {
      applyMe(await updateMyProfile({ firstName: firstName.trim(), lastName: lastName.trim() }));
      setSaved(true);
    } catch {
      setError(t('profile.error'));
    } finally {
      setBusy(null);
    }
  }

  async function pickPicture(source: 'library' | 'camera') {
    setPickerOpen(false);
    setError(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('profile.permissionDenied'));
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      // The picture is only ever shown in a circle, so it is cropped to a
      // square here rather than centre-cropped on the fly everywhere it
      // appears. Quality is dropped too: nothing is displayed above 64pt.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    const picked = result.canceled ? undefined : result.assets[0];
    if (!picked) return;

    setBusy('picture');
    try {
      applyMe(await uploadMyAvatar(picked.uri));
      setSaved(true);
    } catch {
      setError(t('profile.error'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.titleRow}>
          <AccessibleText variant="title" style={styles.title}>
            {t('profile.title')}
          </AccessibleText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('places.close')}
            onPress={onClose}
            style={styles.closeButton}
          >
            <CloseIcon size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          {!me ? (
            <FormCard>
              <FormRow label={t('profile.title')}>
                <AccessibleText variant="body">{t('profile.signedOutExplainer')}</AccessibleText>
                <AccessibleButton
                  label={t('home.signInButton')}
                  style={styles.rowAction}
                  onPress={() => {
                    onClose();
                    onSignIn();
                  }}
                />
              </FormRow>
            </FormCard>
          ) : (
            <>
              {/* One card for the whole form: the picture, then the two
                  names, separated by hairlines rather than by boxes of
                  their own. */}
              <FormCard>
                <FormRow label={t('profile.pictureLabel')}>
                  <View style={styles.pictureRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        me.avatarUrl ? t('profile.changePicture') : t('profile.addPicture')
                      }
                      onPress={() => setPickerOpen(true)}
                      disabled={busy !== null}
                    >
                      <Avatar me={me} size={84} />
                      <View style={styles.pictureBadge}>
                        <CameraIcon size={20} color={colors.primaryText} />
                      </View>
                    </Pressable>

                    <View style={styles.pictureActions}>
                      {busy === 'picture' ? (
                        <View style={styles.busyRow}>
                          <ActivityIndicator color={colors.primaryStrong} />
                          <AccessibleText variant="body" color={colors.textMuted}>
                            {t('profile.saving')}
                          </AccessibleText>
                        </View>
                      ) : (
                        <AccessibleButton
                          label={me.avatarUrl ? t('profile.changePicture') : t('profile.addPicture')}
                          onPress={() => setPickerOpen(true)}
                        />
                      )}
                    </View>
                  </View>
                </FormRow>

                <FormDivider />

                <FormField
                  label={t('profile.firstNameLabel')}
                  value={firstName}
                  onChangeText={(value) => {
                    setFirstName(value);
                    setSaved(false);
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                <FormDivider />

                <FormField
                  label={t('profile.lastNameLabel')}
                  value={lastName}
                  onChangeText={(value) => {
                    setLastName(value);
                    setSaved(false);
                  }}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (nameChanged) void saveName();
                  }}
                />
              </FormCard>

              {/* Every action is a filled button now, so "nothing to
                  save" is said by the disabled state rather than by a
                  second look. */}
              <AccessibleButton
                label={busy === 'name' ? t('profile.saving') : t('profile.save')}
                onPress={() => void saveName()}
                disabled={busy !== null || !nameChanged}
                style={nameChanged ? undefined : styles.buttonDisabled}
              />

              {error && (
                <AccessibleText variant="body" color={colors.danger}>
                  {error}
                </AccessibleText>
              )}
              {saved && !error && (
                <AccessibleText variant="body" color={colors.primaryStrong}>
                  {t('profile.saved')}
                </AccessibleText>
              )}

              <AccessibleText variant="caption" color={colors.textMuted} style={styles.laterNote}>
                {t('profile.laterLabel')}
              </AccessibleText>

              {/* The white row with a red label, the same look "Leave
                  this place" already has in the More menu: undoing
                  something never wears the colour that saves. */}
              <AccessibleButton
                label={t('home.signOutButton')}
                variant="destructive"
                onPress={() => {
                  onClose();
                  void signOut();
                }}
              />

              {/* Their data: a copy, the documents, and the way out for
                  good, which asks before acting like "Leave this place". */}
              <AccessibleText variant="caption" color={colors.textMuted} style={styles.laterNote}>
                {t('privacy.dataTitle')}
              </AccessibleText>
              <AccessibleButton
                label={t('privacy.download')}
                variant="secondary"
                onPress={() => void downloadMyData()}
              />
              <AccessibleButton
                label={t('privacy.privacyPolicy')}
                variant="secondary"
                onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => undefined)}
              />
              <AccessibleButton
                label={t('privacy.terms')}
                variant="secondary"
                onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL).catch(() => undefined)}
              />
              <AccessibleButton
                label={t('privacy.deleteAccount')}
                variant="destructive"
                onPress={() => {
                  setDeleteError(null);
                  setConfirmingDelete(true);
                }}
              />
            </>
          )}
        </ScrollView>

        {/* Where the picture comes from, asked as two big buttons rather
            than a system action sheet, which is small and easy to miss. */}
        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
          <Pressable
            style={styles.scrim}
            onPress={() => setPickerOpen(false)}
            accessibilityLabel={t('profile.cancel')}
          />
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <AccessibleButton
              label={t('profile.choosePhoto')}
              onPress={() => void pickPicture('library')}
            />
            <AccessibleButton
              label={t('profile.takePhoto')}
              onPress={() => void pickPicture('camera')}
            />
            <AccessibleButton
              label={t('profile.cancel')}
              variant="secondary"
              onPress={() => setPickerOpen(false)}
            />
          </View>
        </Modal>

        <Modal
          visible={confirmingDelete}
          transparent
          animationType="fade"
          onRequestClose={() => !deleting && setConfirmingDelete(false)}
        >
          <Pressable
            style={styles.scrim}
            onPress={() => !deleting && setConfirmingDelete(false)}
            accessibilityLabel={t('profile.cancel')}
          />
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <AccessibleText variant="title">{t('privacy.deleteQuestion')}</AccessibleText>
            <AccessibleText variant="body" color={colors.textMuted}>
              {t('privacy.deleteExplainer')}
            </AccessibleText>
            {deleteError && (
              <AccessibleText variant="body" color={colors.danger}>
                {deleteError}
              </AccessibleText>
            )}
            {deleting ? (
              <ActivityIndicator color={colors.primaryStrong} size="large" />
            ) : (
              <>
                <AccessibleButton label={t('privacy.deleteConfirm')} onPress={() => void deleteAccount()} />
                <AccessibleButton
                  label={t('profile.cancel')}
                  variant="secondary"
                  onPress={() => setConfirmingDelete(false)}
                />
              </>
            )}
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardSurface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pictureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pictureBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pictureActions: {
    flex: 1,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowAction: {
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  laterNote: {
    paddingHorizontal: spacing.xs,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
}));
