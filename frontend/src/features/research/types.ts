export type RunStatus = "pending" | "running" | "completed" | "failed" | "interrupted";
export type RunStep = "planning" | "searching" | "extracting" | "analyzing" | "scoring";
export type QueryStatus = "pending" | "completed" | "failed";
export type AIProviderName = "gemini" | "ollama" | "fake" | "legacy";
export type ResearchCategory =
  | "market"
  | "customers"
  | "competition"
  | "substitutes"
  | "technology"
  | "regulation"
  | "pricing"
  | "other";
export type SourceType =
  | "news"
  | "company_site"
  | "government"
  | "academic"
  | "marketplace"
  | "social"
  | "blog"
  | "review_site"
  | "other"
  | "unknown";

export interface ResearchRun {
  id: string;
  status: RunStatus;
  current_step: RunStep | null;
  progress_pct: number;
  ai_provider: AIProviderName;
  ai_model: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface QuerySource {
  source_id: string;
  url: string;
  domain: string;
  title: string | null;
  source_type: SourceType;
  was_cited: boolean;
  rank: number | null;
}

export interface Evidence {
  id: string;
  source_id: string;
  content: string;
  span_start: number | null;
  span_end: number | null;
}

export interface ResearchQuery {
  id: string;
  position: number;
  category: ResearchCategory;
  question: string;
  status: QueryStatus;
  response_text: string | null;
  executed_queries: string[];
  search_suggestions_html: string | null;
  completed_at: string | null;
  sources: QuerySource[];
  evidence: Evidence[];
}

export interface ResearchRunDetail extends ResearchRun {
  queries: ResearchQuery[];
}

export interface Source {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  source_type: SourceType;
  created_at: string;
  citation_count: number;
  evidence_count: number;
}
