import type { ReviewStatus } from "../findings/types";
import type { AttributeType, Origin } from "../projects/types";
import type { Level } from "../findings/types";

export type Priority = "low" | "medium" | "high";
export type RiskCategory = "market" | "competition" | "technical" | "regulatory" | "financial" | "operational" | "other";
export type ValidationStatus = "pending" | "in_progress" | "validated" | "invalidated" | "inconclusive";
export type ResolutionStatus = "open" | "resolved" | "dismissed";
export type AnalysisKindKey = "opportunities" | "risks" | "hypotheses" | "missing-information";

export interface FindingBrief {
  id: string;
  finding_type: string;
  statement: string;
  confidence_level: Level;
  review_status: ReviewStatus;
}

export interface AnalysisItemBase {
  id: string;
  run_id: string | null;
  origin: Origin;
  review_status: ReviewStatus;
  created_at: string;
  updated_at: string;
  findings: FindingBrief[];
}

export interface Opportunity extends AnalysisItemBase {
  title: string;
  description: string;
  potential: Level;
}

export interface Risk extends AnalysisItemBase {
  title: string;
  description: string;
  category: RiskCategory;
  likelihood: Level;
  impact: Level;
  mitigation: string | null;
}

export interface ValidationHypothesis extends AnalysisItemBase {
  statement: string;
  related_attribute: AttributeType | null;
  validation_method: string | null;
  success_criteria: string | null;
  priority: Priority;
  validation_status: ValidationStatus;
  result_notes: string | null;
}

export interface MissingInformation extends AnalysisItemBase {
  question: string;
  reason: string | null;
  related_attribute: AttributeType | null;
  priority: Priority;
  resolution_status: ResolutionStatus;
  resolution_notes: string | null;
}

export interface AnalysisOverview {
  opportunities: Opportunity[];
  risks: Risk[];
  hypotheses: ValidationHypothesis[];
  missing_information: MissingInformation[];
}

export type OpportunityInput = Pick<Opportunity, "title" | "description" | "potential"> & { finding_ids: string[] };
export type RiskInput =
  Pick<Risk, "title" | "description" | "category" | "likelihood" | "impact" | "mitigation"> & {
    finding_ids: string[];
  };
export type HypothesisInput =
  Pick<ValidationHypothesis, "statement" | "related_attribute" | "validation_method" | "success_criteria" | "priority"> & {
    finding_ids: string[];
  };
export type MissingInformationInput =
  Pick<MissingInformation, "question" | "reason" | "related_attribute" | "priority">;

export type AnalysisCreateInput =
  | { kind: "opportunities"; data: OpportunityInput }
  | { kind: "risks"; data: RiskInput }
  | { kind: "hypotheses"; data: HypothesisInput }
  | { kind: "missing-information"; data: MissingInformationInput };

export type AnalysisItem = Opportunity | Risk | ValidationHypothesis | MissingInformation;
export type AnalysisUpdate =
  | Partial<Pick<Opportunity, "title" | "description" | "potential" | "review_status">>
  | Partial<Pick<Risk, "title" | "description" | "category" | "likelihood" | "impact" | "mitigation" | "review_status">>
  | Partial<
      Pick<
        ValidationHypothesis,
        "statement" | "related_attribute" | "validation_method" | "success_criteria" | "priority" | "review_status" | "validation_status" | "result_notes"
      >
    >
  | Partial<
      Pick<
        MissingInformation,
        "question" | "reason" | "related_attribute" | "priority" | "review_status" | "resolution_status" | "resolution_notes"
      >
    >;
