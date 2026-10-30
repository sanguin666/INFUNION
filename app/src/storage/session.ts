import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ansae.session.v1';

/**
 * The signed-in congregant's access token, kept on the device so someone
 * who signs in once stays signed in — an audience that struggles with a
 * password should not be asked for an SMS code every time they open the
 * app. The token itself lasts 90 days (MEMBER_SESSION in the backend's
 * phone-auth.service.ts), and the app signs out cleanly when it runs out.
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (a locked device, a browser with storage
    // blocked): treat it as signed out rather than failing to start.
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, token);
  } catch {
    // The session just won't survive a restart.
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do — the in-memory session is cleared either way.
  }
}

const LAST_LOGIN_KEY = 'ansae.last-login.v1';

// `phone` holds whatever was typed to sign in, an email address or a
// number; the name stays for the sessions stored before email sign-in.
export type LastLogin = { phone: string; firstName: string };

/**
 * The email or number and first name last used to sign in on this phone, so after
 * signing out (or a session running out) the form comes back filled in and
 * signing in again is one tap and a code.
 */
export async function getLastLogin(): Promise<LastLogin | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_LOGIN_KEY);
    return raw ? (JSON.parse(raw) as LastLogin) : null;
  } catch {
    return null;
  }
}

export async function storeLastLogin(login: LastLogin): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(login));
  } catch {
    // The form just starts empty next time.
  }
}
