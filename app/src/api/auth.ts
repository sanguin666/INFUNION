import { Platform } from 'react-native';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './client';
import type { Poi } from './types';

export type RequestCodeResult = {
  expiresInSeconds: number;
  // Where the code went: a text message or an email.
  channel: 'sms' | 'email';
  // Present only when the backend has nothing set up to send the code,
  // which is the normal state on a development machine. The login screen
  // shows it so the flow can be completed without a real message arriving.
  devCode?: string;
};

export type Me = {
  id: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  // Relative path served by the backend (/uploads/avatars/…), or absent
  // for the many people who never set a picture.
  avatarUrl?: string;
  // The place to reopen for somebody who belongs to more than one. May
  // name a place they have since left, so it is a preference to check
  // against `pois`, not an answer on its own.
  lastActivePoiId?: string;
  language: string;
  // True until this person has accepted the current terms and privacy
  // policy (`consentVersion`); the app asks before anything else.
  consentRequired?: boolean;
  consentVersion?: string;
  adminPois: Poi[];
  pois: Poi[];
};

/**
 * Asks for a sign-in code. `login` is whatever was typed in the one field:
 * an email address or a phone number, the backend tells them apart.
 * `language` is the one the email is written in.
 */
export function requestLoginCode(login: string, language: string): Promise<RequestCodeResult> {
  return apiPost<RequestCodeResult>('/auth/code/request', { login, language });
}

export function verifyLoginCode(
  login: string,
  code: string,
  firstName?: string,
): Promise<{ accessToken: string }> {
  return apiPost<{ accessToken: string }>('/auth/code/verify', {
    login,
    code,
    firstName: firstName?.trim() || undefined,
  });
}

/**
 * Whether the backend offers the demo account (no SMS sender, not in
 * production unless DEMO_LOGIN=on). Decides whether the "demo sign-in"
 * button shows under the real sign-in.
 */
export async function demoSignInAvailable(): Promise<boolean> {
  const { enabled } = await apiGet<{ enabled: boolean }>('/auth/demo');
  return enabled;
}

/** Straight into the demo member's account, with no code. */
export async function demoSignIn(): Promise<string> {
  const { accessToken } = await apiPost<{ accessToken: string }>('/auth/demo', {});
  return accessToken;
}

export function getMe(): Promise<Me> {
  return apiGet<Me>('/auth/me');
}

/**
 * The settings menu's name field. Only what changed is sent, and the whole
 * of `me` comes back so the session can be replaced rather than patched.
 */
export function updateMyProfile(profile: {
  firstName?: string;
  lastName?: string;
}): Promise<Me> {
  return apiPatch<Me>('/auth/me', profile);
}

/**
 * The profile picture, from the camera roll or the camera. Same two-sided
 * dance as a voice message: a real Blob on web, React Native's own
 * {uri, name, type} file part everywhere else.
 */
export async function uploadMyAvatar(imageUri: string): Promise<Me> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((response) => response.blob());
    formData.append('image', blob, `avatar.${extensionForMimeType(blob.type)}`);
  } else {
    const extension = imageUri.split('.').pop()?.toLowerCase();
    const safeExtension = extension === 'png' ? 'png' : 'jpg';
    formData.append('image', {
      uri: imageUri,
      name: `avatar.${safeExtension}`,
      type: safeExtension === 'png' ? 'image/png' : 'image/jpeg',
    } as unknown as Blob);
  }

  return apiPostForm<Me>('/auth/me/avatar', formData);
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

/**
 * Records where somebody is, as they enter a place. Fire and forget from
 * the app's side: failing to remember is not worth interrupting anyone
 * over, it only means the next launch falls back to their first place.
 */
export function setLastActivePoi(poiId: string): Promise<Me> {
  return apiPatch<Me>('/auth/me/last-poi', { poiId });
}

// Called whenever a signed-in person opens a place, so "my places" follows
// the account rather than the device. Joining a place you already belong to
// is not an error — the backend returns the existing membership.
// A church answers 428 until the person has agreed that following it
// records their religious belief; `religiousConsent` is that agreement.
export function joinPoi(qrCodeToken: string, religiousConsent?: boolean): Promise<unknown> {
  return apiPost<unknown>('/auth/me/pois', religiousConsent ? { qrCodeToken, religiousConsent } : { qrCodeToken });
}

/** Whether a failed join is the church question rather than a real error. */
export function needsReligiousConsent(error: unknown): boolean {
  return error instanceof ApiError && error.status === 428;
}

/** Records that the terms and privacy policy of `version` were accepted. */
export function acceptTerms(version: string): Promise<void> {
  return apiPost<void>('/auth/me/consent', { version });
}

/**
 * A ten-minute link to a copy of everything infunion holds about this
 * person, for the phone's browser to download. Relative, like every
 * signed link: uploadUri() puts the API address in front.
 */
export async function getMyDataLink(): Promise<string> {
  const { url } = await apiPost<{ url: string }>('/auth/me/export-link');
  return url;
}

/** Deletes the account for good. 409 means it runs a place. */
export function deleteMyAccount(): Promise<void> {
  return apiDelete('/auth/me');
}

/**
 * Leaves a place from the "More" menu. Nothing about the place itself is
 * touched — this only ends this person's membership, and scanning its QR
 * code again puts them straight back.
 */
export function leavePoi(poiId: string): Promise<void> {
  return apiDelete(`/auth/me/pois/${poiId}`);
}
