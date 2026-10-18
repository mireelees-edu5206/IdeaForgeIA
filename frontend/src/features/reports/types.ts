import type { AIProviderName } from "../research/types";

export type ReportStatus = "generating" | "completed" | "failed";

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

export interface ReportSection {
  id: string;
  section_type: ReportSectionType;
  position: number;
  title: string;
  content: string;
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
