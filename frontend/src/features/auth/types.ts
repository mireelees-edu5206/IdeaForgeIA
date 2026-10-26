export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
