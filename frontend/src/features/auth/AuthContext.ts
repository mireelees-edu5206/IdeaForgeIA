import { createContext, useContext } from "react";

import type { LoginInput, RegisterInput, User } from "./types";

/** unavailable: no se pudo configurar Supabase o verificar el perfil en el backend. */
export type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  sessionExpired: boolean;
  login: (data: LoginInput) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return context;
}
