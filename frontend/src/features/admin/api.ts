import { apiRequest } from "../../lib/apiClient";
import type { AdminOverview, AdminUser, AdminUserUpdate } from "./types";

export const adminApi = {
  overview: () => apiRequest<AdminOverview>("/admin/overview"),
  listUsers: () => apiRequest<AdminUser[]>("/admin/users"),
  updateUser: (userId: string, data: AdminUserUpdate) =>
    apiRequest<AdminUser>(`/admin/users/${userId}`, { method: "PATCH", body: data }),
};
