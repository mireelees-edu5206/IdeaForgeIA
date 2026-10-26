import type { AIProviderName } from "../research/types";

export type ReportStatus = "generating" | "completed" | "failed";

export interface GeographicScopeInput {
  query: string;
  latitude?: number;
  longitude?: number;
  radius_m?: number;
  keyword?: string;
}

export type ReportSectionType =
  | "executive_summary"
  | "idea_overview"
  | "market"
  | "competition"
  | "opportunities"
  | "risks"
  | "hypotheses"
  | "missing_information"
  | "sources"
  | "conclusions";

export interface VerdictInvestment {
  minimum_mxn: number;
  maximum_mxn: number;
  basis: string;
  assumptions: string[];
  evidence_refs: string[];
}

export interface VerdictZone {
  name: string;
  reason: string;
  place_refs: string[];
  caveat: string;
}

export interface BusinessVerdict {
  recommendation: "worth_testing" | "needs_validation" | "do_not_proceed_yet" | "insufficient_information";
  confidence: "low" | "medium" | "high";
  summary: string;
  investment: VerdictInvestment | null;
  zones: VerdictZone[];
  missing_information: string[];
  next_steps: string[];
}

export interface ReportSection {
  id: string;
  section_type: ReportSectionType;
  position: number;
  title: string;
  content: string;
  verdict?: BusinessVerdict | null;
}

export interface Report {
  id: string;
  project_id: string;
  run_id: string | null;
  version: number;
  title: string;
  status: ReportStatus;
  ai_provider: AIProviderName;
  ai_model: string;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ReportListItem extends Report {
  section_count: number;
}

export interface ReportDetail extends Report {
  sections: ReportSection[];
}
