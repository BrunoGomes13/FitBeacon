import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, logoutCurrentSession, refreshSession } from '../lib/api';
import { clearTokens, getTokens, setTokens } from '../lib/session';
import type { AdminUser, AuthTokens, LoginResponse } from '../lib/types';

type AuthContextValue = {
  user: AdminUser | null;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<AdminUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function expiryDelay(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 14 * 60_000;
  const unit = match[2];
  const multiplier = unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return Math.max(1_000, Number(match[1]) * multiplier - 60_000);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);

  const signOut = useCallback(async () => {
    await logoutCurrentSession();
    setUser(null);
    setAccessToken(null);
    clearTokens();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      authenticated: false,
    });
    if (result.user.role !== 'admin') {
      clearTokens();
      throw new Error('Esta conta é de aluno. Use uma conta de administrador para acessar o painel.');
    }

    const nextTokens: AuthTokens = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
    setTokens(nextTokens);
    setUser(result.user);
    setAccessToken(result.accessToken);
    setAuthEpoch((value) => value + 1);
    return result.user;
  }, []);

  useEffect(() => {
    const onExpired = (): void => {
      setUser(null);
      setAccessToken(null);
    };
    const onTokenChange = (event: Event): void => {
      const next = (event as CustomEvent<AuthTokens>).detail;
      setAccessToken(next.accessToken);
      setAuthEpoch((value) => value + 1);
    };
    window.addEventListener('fitbeacon:session-expired', onExpired);
    window.addEventListener('fitbeacon:tokens', onTokenChange);
    return () => {
      window.removeEventListener('fitbeacon:session-expired', onExpired);
      window.removeEventListener('fitbeacon:tokens', onTokenChange);
    };
  }, []);

  useEffect(() => {
    const current = getTokens();
    if (!user || !current) return;
    const timer = window.setTimeout(async () => {
      try {
        await refreshSession();
      } catch {
        setUser(null);
        setAccessToken(null);
        clearTokens();
      }
    }, expiryDelay(current.expiresIn));
    return () => window.clearTimeout(timer);
  }, [accessToken, authEpoch, signOut, user]);

  const value = useMemo(() => ({ user, accessToken, signIn, signOut }), [accessToken, signIn, signOut, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}

export { AuthContext };
