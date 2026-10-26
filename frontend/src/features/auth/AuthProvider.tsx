import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type AuthError, type Session } from "@supabase/supabase-js";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, onSessionExpired } from "../../lib/apiClient";
import { getSupabase, supabase } from "../../lib/supabaseClient";
import { authApi } from "./api";
import { type AuthContextValue, type AuthStatus, AuthContext } from "./AuthContext";
import type { LoginInput, RegisterInput } from "./types";

export const ME_QUERY_KEY = ["auth", "me"] as const;

function readableAuthError(error: AuthError): Error {
  switch (error.code) {
    case "invalid_credentials":
      return new Error("El correo o la contraseña no son correctos.");
    case "email_not_confirmed":
      return new Error("Confirma tu correo electrónico antes de iniciar sesión.");
    case "user_already_exists":
      return new Error("Ya existe una cuenta con ese correo.");
    case "weak_password":
      return new Error("La contraseña no cumple los requisitos de seguridad.");
    default:
      return new Error("No se pudo completar el acceso. Inténtalo de nuevo.");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const me = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    enabled: Boolean(session && supabase),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    localStorage.removeItem("ideaforge.access_token");
    localStorage.removeItem("ideaforge.refresh_token");
    if (!supabase) {
      setInitialized(true);
      return;
    }

    let currentUserId: string | null = null;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (currentUserId !== nextUserId) queryClient.clear();
      currentUserId = nextUserId;
      setSession(nextSession);
      setInitialized(true);
    });

    void supabase.auth.getSession().then(({ data: result, error }) => {
      if (error) {
        setSession(null);
      } else {
        setSession(result.session);
      }
      setInitialized(true);
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  useEffect(
    () =>
      onSessionExpired(() => {
        setSessionExpired(true);
        setSession(null);
        queryClient.clear();
      }),
    [queryClient],
  );

  const login = useCallback(
    async (credentials: LoginInput) => {
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (error) throw readableAuthError(error);
      if (!data.session) throw new Error("No se pudo iniciar sesión. Inténtalo de nuevo.");
      setSessionExpired(false);
      await queryClient.fetchQuery({ queryKey: ME_QUERY_KEY, queryFn: authApi.me });
    },
    [queryClient],
  );

  const loginWithGoogle = useCallback(async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw readableAuthError(error);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.full_name },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw readableAuthError(error);
    return data.session === null;
  }, []);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut().catch(() => undefined);
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const retry = useCallback(() => {
    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    }
    void me.refetch();
  }, [me]);

  let status: AuthStatus;
  if (!initialized) status = "loading";
  else if (!supabase) status = "unavailable";
  else if (!session) status = "anonymous";
  else if (me.data) status = "authenticated";
  else if (me.isError) {
    status = me.error instanceof ApiError && me.error.status === 401 ? "anonymous" : "unavailable";
  } else status = "loading";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: status === "authenticated" ? (me.data ?? null) : null,
      sessionExpired,
      login,
      loginWithGoogle,
      register,
      logout,
      retry,
    }),
    [status, me.data, sessionExpired, login, loginWithGoogle, register, logout, retry],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
