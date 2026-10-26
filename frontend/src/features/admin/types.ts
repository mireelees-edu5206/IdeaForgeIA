import type { UserRole } from "../auth/types";
import type { GeoBusiness } from "../geo/types";
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

export type TraceAlgorithm = "bfs" | "dfs";
export type RouteAlgorithm = "hill_climbing" | "genetic" | "exact";
export type BudgetAlgorithm = "hill_climbing" | "exact";
export type ValidationShift = "matutino" | "vespertino" | "nocturno";

export interface AdminLabProject {
  id: string;
  title: string;
  status: ProjectStatus;
  owner_name: string;
  geographic_scope: string | null;
}

export interface AdminLabProjects {
  projects: AdminLabProject[];
}

export interface TraceGraphNode {
  id: string;
  label: string;
  kind:
    | "project"
    | "attribute"
    | "research_run"
    | "query"
    | "source"
    | "evidence"
    | "finding"
    | "entity"
    | "competitor"
    | "opportunity"
    | "risk"
    | "hypothesis"
    | "missing_information"
    | "report"
    | "report_section";
  details: Record<string, unknown>;
}

export interface TraceGraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface ProjectTraceGraph {
  project_id: string;
  project_title: string;
  root_id: string;
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
  truncated: boolean;
}

export interface TracePathResult {
  algorithm: TraceAlgorithm;
  root_id: string;
  target_node_id: string;
  path: TraceGraphNode[];
  visited_node_ids: string[];
  expanded_count: number;
  found: boolean;
}

export interface LabPlaceSearchRequest {
  latitude: number;
  longitude: number;
  radius_m: number;
  keyword: string;
}

export interface LabPlaceSearchResult {
  project_id: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  keyword: string;
  places: GeoBusiness[];
  attribution: string;
  note: string;
}

export interface LabRouteRequest extends LabPlaceSearchRequest {
  selected_place_ids: string[];
  algorithm: RouteAlgorithm;
  seed: number;
  population_size: number;
  generations: number;
}

export interface LabRouteStop {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  name: string;
  latitude: number;
  longitude: number;
  distance_from_previous_km: number;
}

export interface LabRouteResult {
  project_id: string;
  keyword: string;
  algorithm: RouteAlgorithm;
  depot_latitude: number;
  depot_longitude: number;
  stops: LabRouteStop[];
  return_distance_km: number;
  total_distance_km: number;
  optimal_reference_km: number;
  evaluations: number;
  history_km: number[];
  distance_note: string;
  persisted: false;
}

export interface HypothesisBudgetRequest {
  budget: number;
  algorithm: BudgetAlgorithm;
  items: Array<{
    hypothesis_id: string;
    estimated_cost: number;
    expected_value: number;
  }>;
}

export interface HypothesisBudgetResult {
  project_id: string;
  algorithm: BudgetAlgorithm;
  budget: number;
  selected: Array<{
    hypothesis_id: string;
    statement: string;
    priority: "low" | "medium" | "high";
    estimated_cost: number;
    expected_value: number;
  }>;
  total_cost: number;
  total_value: number;
  exact_reference_value: number;
  evaluations: number;
  persisted: false;
}

export interface ValidationScheduleRequest {
  capacity_per_shift: number;
  tasks: Array<{ hypothesis_id: string; preferred_shift: ValidationShift }>;
}

export interface ValidationScheduleResult {
  project_id: string;
  assignments: Array<{
    hypothesis_id: string;
    statement: string;
    priority: "low" | "medium" | "high";
    preferred_shift: ValidationShift;
    assigned_shift: ValidationShift;
  }>;
  satisfied_preferences: number;
  priority_weighted_score: number;
  evaluations: number;
  persisted: false;
}

export interface LabMetricPoint {
  day: string;
  calls: number;
  success_calls: number;
  error_calls: number;
  avg_latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
}

export interface LabMetrics {
  days: number;
  points: LabMetricPoint[];
}

export interface PropositionDefinition {
  symbol: string;
  name: string;
  meaning: string;
}

export interface TruthTableRow {
  values: Record<string, boolean>;
  result: boolean;
}

export interface PropositionRuleTable {
  id: string;
  title: string;
  description: string;
  source: string;
  formula: string;
  inputs: PropositionDefinition[];
  output: PropositionDefinition;
  rows: TruthTableRow[];
  note: string;
}

export interface PeasDimension {
  symbol: string;
  name: string;
  description: string;
}

export interface LabPropositions {
  rules: PropositionRuleTable[];
  peas: PeasDimension[];
}
