import type { IconType } from "react-icons";
import { FiActivity, FiCheckCircle, FiEdit3, FiSearch } from "react-icons/fi";

import type { AttributeType, ProjectStatus } from "./types";

// Deben coincidir con las reglas del backend.
export const RAW_IDEA_MIN_LENGTH = 20;
export const RAW_IDEA_MAX_LENGTH = 5000;
export const TITLE_MAX_LENGTH = 200;
export const ATTRIBUTE_VALUE_MAX_LENGTH = 4000;
export const MAX_VALUES_PER_ATTRIBUTE = 10;

export const STATUS_META: Record<ProjectStatus, { label: string; className: string; icon: IconType }> = {
  draft: { label: "Borrador", className: "text-slate-200 bg-slate-400/15 ring-slate-300/25", icon: FiEdit3 },
  structured: { label: "Estructurado", className: "text-sky-200 bg-sky-400/15 ring-sky-300/30", icon: FiCheckCircle },
  researching: {
    label: "En investigación",
    className: "text-amber-200 bg-amber-400/15 ring-amber-300/30",
    icon: FiSearch,
  },
  analyzed: {
    label: "Analizado",
    className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30",
    icon: FiActivity,
  },
};

export const PROJECT_STATUSES = Object.keys(STATUS_META) as ProjectStatus[];

/** Orden del formulario (mismo orden que el backend). */
export const ATTRIBUTE_META: Record<AttributeType, { label: string; question: string; placeholder: string }> = {
  problem: {
    label: "Problema",
    question: "¿Qué problema o necesidad resuelve tu idea?",
    placeholder: "Ej.: los restaurantes pagan sobrecostes por los intermediarios",
  },
  solution: {
    label: "Solución",
    question: "¿Cómo lo resuelve tu propuesta?",
    placeholder: "Ej.: un marketplace que conecta directamente con productores",
  },
  customer_segment: {
    label: "Segmento de clientes",
    question: "¿Quién tiene el problema y pagaría por resolverlo?",
    placeholder: "Ej.: restaurantes independientes de 10 a 50 mesas",
  },
  product_service: {
    label: "Producto o servicio",
    question: "¿Qué ofreces exactamente?",
    placeholder: "Ej.: plataforma web con pedidos semanales y logística",
  },
  channels: {
    label: "Canales",
    question: "¿Cómo llegarás a tus clientes?",
    placeholder: "Ej.: venta directa, asociaciones de hostelería",
  },
  revenue_model: {
    label: "Modelo de ingresos",
    question: "¿Cómo generará ingresos?",
    placeholder: "Ej.: comisión del 8 % por pedido",
  },
  geographic_scope: {
    label: "Alcance geográfico",
    question: "¿Dónde operarás?",
    placeholder: "Ej.: área metropolitana de Monterrey",
  },
  differentiators: {
    label: "Diferenciadores declarados",
    question: "¿Qué crees que te distingue de las alternativas?",
    placeholder: "Ej.: trazabilidad del origen de cada producto",
  },
  technologies: {
    label: "Tecnologías relevantes",
    question: "¿Qué tecnologías son clave para tu idea?",
    placeholder: "Ej.: app móvil, pagos en línea",
  },
};

export const ATTRIBUTE_TYPES = Object.keys(ATTRIBUTE_META) as AttributeType[];
export const REQUIRED_ATTRIBUTES: AttributeType[] = ["problem", "solution", "customer_segment"];
