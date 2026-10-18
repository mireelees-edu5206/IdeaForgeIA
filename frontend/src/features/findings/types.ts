import type { Origin } from "../projects/types";
import type { ResearchCategory, SourceType } from "../research/types";

export type Level = "low" | "medium" | "high" | "undetermined";
export type ReviewStatus = "proposed" | "accepted" | "rejected";
export type EvidenceStance = "supports" | "contradicts" | "context";
export type EntityType = "company" | "product" | "technology" | "organization" | "other";
export type CompetitorType = "direct" | "indirect" | "substitute" | "alternative";

export interface FindingEvidence {
  evidence_id: string;
  stance: EvidenceStance;
  content: string;
  source: { id: string; url: string; domain: string; title: string | null; source_type: SourceType };
}

export interface Finding {
  id: string;
  run_id: string | null;
  origin: Origin;
  review_status: ReviewStatus;
  finding_type: ResearchCategory;
  statement: string;
  confidence_level: Level;
  confidence_rationale: string | null;
  created_at: string;
  updated_at: string;
  evidence: FindingEvidence[];
  entities: Array<{ id: string; name: string; entity_type: EntityType }>;
}

export interface FindingInput {
  finding_type: ResearchCategory;
  statement: string;
  confidence_level: Level;
  confidence_rationale?: string;
}

export interface FindingFilters {
  run_id?: string;
  finding_type?: ResearchCategory;
  review_status?: ReviewStatus;
}

export interface EntityBrief {
  id: string;
  entity_type: EntityType;
  name: string;
  website: string | null;
  description: string | null;
}

export interface Entity extends EntityBrief {
  finding_count: number;
  competitor_id: string | null;
}

export interface Competitor {
  id: string;
  entity: EntityBrief;
  competitor_type: CompetitorType;
  threat_level: Level;
  rationale: string | null;
  origin: Origin;
  review_status: ReviewStatus;
  run_id: string | null;
  finding_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompetitorInput {
  entity_id?: string;
  name?: string;
  website?: string;
  competitor_type: CompetitorType;
  threat_level?: Level;
  rationale?: string;
}

export type CompetitorUpdate = Partial<Pick<Competitor, "competitor_type" | "threat_level" | "review_status">> & {
  rationale?: string;
};
