import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, onSessionExpired } from "../../lib/apiClient";
import { TOKEN_KEYS, tokenStorage } from "../../lib/tokenStorage";
import { authApi } from "./api";
import { type AuthContextValue, type AuthStatus, AuthContext } from "./AuthContext";
import type { LoginInput, RegisterInput } from "./types";

export const ME_QUERY_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasTokens, setHasTokens] = useState(() => tokenStorage.get() !== null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const me = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    enabled: hasTokens,
    staleTime: 5 * 60_000,
  });

  const endSession = useCallback(() => {
    setHasTokens(false);
    queryClient.clear();
  }, [queryClient]);

  // El cliente API avisa cuando el refresh token ya no es válido.
  useEffect(
    () =>
      onSessionExpired(() => {
        setSessionExpired(true);
        endSession();
      }),
    [endSession],
  );

  // Sincroniza login/logout entre pestañas.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !TOKEN_KEYS.includes(event.key as (typeof TOKEN_KEYS)[number])) return;
      if (tokenStorage.get()) {
        setHasTokens(true);
        void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      } else {
        endSession();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [endSession, queryClient]);

  const login = useCallback(
    async (data: LoginInput) => {
      const tokens = await authApi.login(data);
      tokenStorage.set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      await queryClient.fetchQuery({ queryKey: ME_QUERY_KEY, queryFn: authApi.me });
      setSessionExpired(false);
      setHasTokens(true);
    },
    [queryClient],
  );

  const register = useCallback(
    async (data: RegisterInput) => {
      await authApi.register(data);
      await login({ email: data.email, password: data.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    const tokens = tokenStorage.get();
    tokenStorage.clear();
    endSession();
    // Revocar en el servidor es "best effort": la sesión local ya está cerrada.
    if (tokens) await authApi.logout(tokens.refreshToken).catch(() => undefined);
  }, [endSession]);

  let status: AuthStatus;
  if (!hasTokens) status = "anonymous";
  else if (me.data) status = "authenticated";
  else if (me.isError) status = me.error instanceof ApiError && me.error.status === 401 ? "anonymous" : "unavailable";
  else status = "loading";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: status === "authenticated" ? (me.data ?? null) : null,
      sessionExpired,
      login,
      register,
      logout,
      retry: () => void me.refetch(),
    }),
    [status, me, sessionExpired, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
