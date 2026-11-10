import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, login as loginRequest, markTipSeen, resetTips as resetTipsRequest } from '../api/auth';
import { getToken, setSuperadminSession, setToken } from '../api/client';
import type { CurrentUser } from '../api/types';

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  /** Signs in and hands back who signed in. */
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
  /** Fetches the signed-in user again, so places changed since sign-in (a new logo) show up. */
  refreshUser: () => Promise<void>;
  /** The welcome tour and page tips: seen once, on the account. */
  seenTip: (key: string) => boolean;
  dismissTip: (key: string) => void;
  resetTips: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    getCurrentUser()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await loginRequest(email, password);
    setSuperadminSession(null);
    setToken(accessToken);
    const me = await getCurrentUser();
    setUser(me);
    return me;
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await getCurrentUser());
  }, []);

  const logout = useCallback(() => {
    setSuperadminSession(null);
    setToken(null);
    setUser(null);
  }, []);

  const seenTip = useCallback((key: string) => !!user?.seenTips?.includes(key), [user]);

  // Hidden at once; the server is told in the background, and a failure
  // only means the tip comes back on the next visit.
  const dismissTip = useCallback((key: string) => {
    setUser((current) =>
      current ? { ...current, seenTips: [...(current.seenTips ?? []).filter((k) => k !== key), key] } : current,
    );
    markTipSeen(key).catch(() => undefined);
  }, []);

  const resetTips = useCallback(async () => {
    await resetTipsRequest();
    setUser((current) => (current ? { ...current, seenTips: [] } : current));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, seenTip, dismissTip, resetTips }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
