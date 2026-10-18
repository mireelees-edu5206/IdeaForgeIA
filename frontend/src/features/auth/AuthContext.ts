import { createContext, useContext } from "react";

import type { LoginInput, RegisterInput, User } from "./types";

/** unavailable: hay sesión guardada pero el servidor no responde (se ofrece reintentar). */
export type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  sessionExpired: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return context;
}
