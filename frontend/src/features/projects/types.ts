export type ProjectStatus = "draft" | "structured" | "researching" | "analyzed";

export type AttributeType =
  | "problem"
  | "solution"
  | "customer_segment"
  | "product_service"
  | "channels"
  | "revenue_model"
  | "geographic_scope"
  | "differentiators"
  | "technologies";

export type Origin = "ai" | "user";

export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Project extends ProjectSummary {
  raw_idea: string;
}

export interface IdeaAttribute {
  id: string;
  attribute_type: AttributeType;
  value: string;
  position: number;
  origin: Origin;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface StructureCheck {
  ready: boolean;
  missing: AttributeType[];
  pending_suggestions: number;
}

export interface ProjectDetail extends Project {
  attributes: IdeaAttribute[];
  structure: StructureCheck;
}

export interface ProjectsOverview {
  total: number;
  by_status: Record<ProjectStatus, number>;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProjectInput {
  title: string;
  raw_idea: string;
}

export interface ProjectListParams {
  limit: number;
  offset: number;
  status?: ProjectStatus;
}
