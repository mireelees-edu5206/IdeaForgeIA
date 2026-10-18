import type { AttributeType } from "../projects/types";
import type { Priority, ResolutionStatus, RiskCategory, ValidationStatus } from "./types";

export const LEVEL_LABELS = { high: "Alta", medium: "Media", low: "Baja", undetermined: "Indeterminada" } as const;
export const PRIORITY_LABELS: Record<Priority, string> = { high: "Alta", medium: "Media", low: "Baja" };
export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  market: "Mercado",
  competition: "Competencia",
  technical: "Técnico",
  regulatory: "Regulatorio",
  financial: "Financiero",
  operational: "Operativo",
  other: "Otro",
};
export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  validated: "Validada",
  invalidated: "No validada",
  inconclusive: "Inconclusa",
};
export const RESOLUTION_STATUS_LABELS: Record<ResolutionStatus, string> = {
  open: "Pendiente",
  resolved: "Resuelta",
  dismissed: "Descartada",
};
export const ATTRIBUTE_LABELS: Record<AttributeType, string> = {
  problem: "Problema",
  solution: "Solución",
  customer_segment: "Segmento de clientes",
  product_service: "Producto o servicio",
  channels: "Canales",
  revenue_model: "Modelo de ingresos",
  geographic_scope: "Alcance geográfico",
  differentiators: "Diferenciadores",
  technologies: "Tecnologías",
};
