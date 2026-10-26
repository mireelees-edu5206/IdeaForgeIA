import { apiRequest } from "../../lib/apiClient";
import type { User } from "./types";

export const authApi = {
  me: () => apiRequest<User>("/users/me"),
};
