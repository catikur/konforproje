import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, AuthUser, tokenStore } from "./api";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const ACCESS_KEY = "konfor_token";
const REFRESH_KEY = "konfor_refresh";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyTokens = useCallback(
    async (access: string | null, refresh: string | null, persist = true) => {
      setToken(access);
      setRefreshToken(refresh);
      tokenStore.access = access;
      tokenStore.refresh = refresh;
      if (!persist) return;
      if (access && refresh) {
        await AsyncStorage.multiSet([
          [ACCESS_KEY, access],
          [REFRESH_KEY, refresh],
        ]);
      } else {
        await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
      }
    },
    [],
  );

  useEffect(() => {
    tokenStore.setTokens = (access, refresh) => {
      void applyTokens(access, refresh, true);
    };
    return () => {
      tokenStore.setTokens = undefined;
    };
  }, [applyTokens]);

  useEffect(() => {
    (async () => {
      try {
        const [[, savedAccess], [, savedRefresh]] = await AsyncStorage.multiGet([
          ACCESS_KEY,
          REFRESH_KEY,
        ]);
        if (savedRefresh) {
          try {
            const res = await api.refresh(savedRefresh);
            await applyTokens(res.accessToken, res.refreshToken, true);
            const me = await api.me(res.accessToken);
            setUser(me);
            setLoading(false);
            return;
          } catch {
            /* fall through to access token */
          }
        }
        if (savedAccess) {
          const me = await api.me(savedAccess);
          await applyTokens(savedAccess, savedRefresh, true);
          setUser(me);
        }
      } catch {
        await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
        tokenStore.access = null;
        tokenStore.refresh = null;
      } finally {
        setLoading(false);
      }
    })();
  }, [applyTokens]);

  const login = useCallback(
    async (username: string, password: string, rememberMe = true) => {
      const res = await api.login(username, password);
      await applyTokens(res.accessToken, res.refreshToken, rememberMe);
      setUser(res.user);
    },
    [applyTokens],
  );

  const logout = useCallback(async () => {
    await api.logout(refreshToken);
    await applyTokens(null, null, true);
    setUser(null);
  }, [applyTokens, refreshToken]);

  const value = useMemo(
    () => ({ token, user, loading, login, logout }),
    [token, user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider içinde kullanılmalı");
  return ctx;
}
