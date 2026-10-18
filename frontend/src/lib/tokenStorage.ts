/**
 * Tokens en localStorage (decisión D4 de la Fase 1). Mitigación de XSS: nunca se renderiza
 * HTML de la API/IA con dangerouslySetInnerHTML y el access token dura poco.
 */
const ACCESS_KEY = "ideaforge.access_token";
const REFRESH_KEY = "ideaforge.refresh_token";

export const TOKEN_KEYS = [ACCESS_KEY, REFRESH_KEY] as const;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const tokenStorage = {
  get(): Tokens | null {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  },
  set({ accessToken, refreshToken }: Tokens): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
