// Authentication context.
//
// Holds the current user and token, backed by localStorage so a reload keeps
// the session. Exposes login/register/logout. On an expired-session signal the
// token is cleared and the user state reset so protected routes redirect.
//
// When accounts are turned off (VITE_AUTH_ENABLED=false) the provider is
// guest-only: it never restores a stored session, login/register reject, and
// `authEnabled` tells the routes and nav to hide every account entry point.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginRequest, RegisterRequest, User } from '@pixel-race/shared-types';
import { api, clearToken, getToken, setToken } from '../../services/api.ts';
import { authEnabled } from '../../config/features.ts';

interface AuthContextValue {
  /** False when accounts are turned off: the site is guest-only. */
  authEnabled: boolean;
  user: User | null;
  /** True while we are verifying a stored token on first load. */
  initializing: boolean;
  isAuthenticated: boolean;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  enabled = authEnabled,
}: {
  children: ReactNode;
  /** Overrides VITE_AUTH_ENABLED (tests use this). */
  enabled?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(enabled);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // On mount: if a token exists, verify it by fetching the current user.
  // A failure (expired/invalid) clears the session silently. With accounts off
  // the stored token is left alone (not cleared) so turning them back on
  // restores the session.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    async function restore() {
      if (!getToken()) {
        setInitializing(false);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        if (!cancelled) {
          clearToken();
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const login = useCallback(
    async (input: LoginRequest) => {
      if (!enabled) {
        throw new Error('Accounts are turned off');
      }
      const result = await api.login(input);
      setToken(result.token);
      setUser(result.user);
    },
    [enabled],
  );

  const register = useCallback(
    async (input: RegisterRequest) => {
      if (!enabled) {
        throw new Error('Accounts are turned off');
      }
      const result = await api.register(input);
      setToken(result.token);
      setUser(result.user);
    },
    [enabled],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      authEnabled: enabled,
      user,
      initializing,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
    }),
    [enabled, user, initializing, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside the provider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
