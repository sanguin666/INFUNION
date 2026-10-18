import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, login as loginRequest } from '../api/auth';
import { getToken, setSuperadminSession, setToken } from '../api/client';
import type { CurrentUser } from '../api/types';

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  /** Signs in and hands back who signed in. */
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
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

  const logout = useCallback(() => {
    setSuperadminSession(null);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
