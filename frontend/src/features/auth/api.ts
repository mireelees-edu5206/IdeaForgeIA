import { apiRequest } from "../../lib/apiClient";
import type { LoginInput, RegisterInput, TokenPair, User } from "./types";

export const authApi = {
  login: (data: LoginInput) =>
    apiRequest<TokenPair>("/auth/login", { method: "POST", body: data, auth: false }),
  register: (data: RegisterInput) =>
    apiRequest<User>("/auth/register", { method: "POST", body: data, auth: false }),
  logout: (refreshToken: string) =>
    apiRequest<void>("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
      auth: false,
    }),
  me: () => apiRequest<User>("/users/me"),
};
