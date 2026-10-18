import type { UserRole } from "../auth/types";
import type { ProjectStatus } from "../projects/types";
import type { AIProviderName } from "../research/types";

export type AIOperation =
  | "idea_structuring"
  | "research_planning"
  | "grounded_search"
  | "extraction"
  | "analysis"
  | "report_generation"
  | "chat";

export type AICallStatus = "success" | "error";

export interface ProviderMetrics {
  provider: AIProviderName;
  total_calls: number;
  success_calls: number;
  error_calls: number;
  avg_latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  search_queries: number;
  estimated_cost_usd: string;
}

export interface AdminAILog {
  id: string;
  user_email: string | null;
  project_title: string | null;
  provider: AIProviderName;
  model: string;
  operation: AIOperation;
  prompt_version: string | null;
  status: AICallStatus;
  error_code: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  search_queries_count: number;
  latency_ms: number | null;
  estimated_cost_usd: string | null;
  created_at: string;
}

export interface AdminOverview {
  total_users: number;
  active_users: number;
  admin_users: number;
  total_projects: number;
  projects_by_status: Record<ProjectStatus, number>;
  total_research_runs: number;
  completed_research_runs: number;
  failed_research_runs: number;
  total_findings: number;
  total_reports: number;
  total_ai_calls: number;
  ai_by_provider: ProviderMetrics[];
  recent_ai_logs: AdminAILog[];
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  project_count: number;
  research_run_count: number;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminUserUpdate {
  role?: UserRole;
  is_active?: boolean;
}
