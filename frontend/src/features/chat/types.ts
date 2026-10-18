import type { Level, ReviewStatus } from "../findings/types";
import type { AIProviderName, ResearchCategory } from "../research/types";
import type { Origin } from "../projects/types";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatTurn[];
}

export interface ChatEvidenceReference {
  stance: "supports" | "contradicts" | "context";
  content: string;
  source_url: string | null;
  source_title: string | null;
  source_domain: string;
}

export interface ChatFindingReference {
  id: string;
  finding_type: ResearchCategory;
  statement: string;
  confidence_level: Level;
  origin: Origin;
  review_status: ReviewStatus;
  evidence: ChatEvidenceReference[];
}

export interface ChatReply {
  answer: string;
  references: ChatFindingReference[];
  provider: AIProviderName | null;
  model: string | null;
}
