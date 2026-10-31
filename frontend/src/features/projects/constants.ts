/**
 * ARCHIVO: projects/constants.ts
 *
 * ¿Qué es?
 * Es la "hoja de textos fijos" de los proyectos: los nombres que ve la persona (Borrador,
 * Problema, Solución...), las preguntas que le hacemos, los ejemplos y los límites de texto.
 * Están en un solo lugar para cambiar un nombre sin buscarlo en todas las pantallas.
 *
 * ¿Para qué sirve?
 * - Los límites (cuántas letras caben en la idea, en un atributo, etc.) que el formulario usa.
 * - Los nombres y colores de cada etapa del proyecto (STATUS_META).
 * - Las preguntas, ejemplos y etiquetas de cada atributo de la idea (ATTRIBUTE_META).
 * - Qué atributos son obligatorios para poder investigar (REQUIRED_ATTRIBUTES).
 *
 * ¿Quién lo usa?
 * NewProjectPage.tsx, ProjectDetailPage.tsx, ProjectsPage.tsx, badges.tsx, StructurePanel.tsx,
 * AttributeSection.tsx y los formularios de la idea.
 *
 * ⚠ Importante: los límites de texto deben ser iguales a los del backend (projects/models.py y
 * projects/schemas.py). Si cambias uno aquí, cámbialo también allá, o el formulario aceptará
 * un texto que el servidor rechazará.
 */

/* "IconType" es el tipo de un icono de react-icons. Lo usamos para guardar el icono de cada etapa. */
import type { IconType } from "react-icons";
/* Traemos cuatro iconos: lápiz (borrador), palomita (listo), lupa (investigando) y actividad (resultados). */
import { FiActivity, FiCheckCircle, FiEdit3, FiSearch } from "react-icons/fi";

/* Tipos de atributo y de etapa, definidos en types.ts. */
import type { AttributeType, ProjectStatus } from "./types";

// Deben coincidir con las reglas del backend.
/**
 * RAW_IDEA_MIN_LENGTH: la idea debe tener al menos 20 caracteres. Así no se acepta una frase de tres palabras.
 */
export const RAW_IDEA_MIN_LENGTH = 20;
/** RAW_IDEA_MAX_LENGTH: la idea puede tener como máximo 5000 caracteres. */
/** Define raw idea max length como dato o funcion publica de projects. */
export const RAW_IDEA_MAX_LENGTH = 5000;
/** TITLE_MAX_LENGTH: el nombre del proyecto puede tener como máximo 200 caracteres. */
/** Define title max length como dato o funcion publica de projects. */
export const TITLE_MAX_LENGTH = 200;
/** ATTRIBUTE_VALUE_MAX_LENGTH: cada atributo (problema, solución...) puede tener hasta 4000 caracteres. */
/** Define attribute value max length como dato o funcion publica de projects. */
export const ATTRIBUTE_VALUE_MAX_LENGTH = 4000;
/** MAX_VALUES_PER_ATTRIBUTE: cada atributo puede tener como máximo 10 valores distintos (por ejemplo, 10 canales). */
/** Define max values per attribute como dato o funcion publica de projects. */
export const MAX_VALUES_PER_ATTRIBUTE = 10;

/**
 * STATUS_META es un "diccionario de etapas": a partir de una etapa (por ejemplo "draft") obtienes
 * su nombre para mostrar, sus colores y su icono. Para usarlo: STATUS_META["draft"].label.
 *
 * Los colores son clases de Tailwind: "text-*" es el color del texto, "bg-*" el fondo y "ring-*" el borde.
 */
/** Define status meta como dato o funcion publica de projects. */
export const STATUS_META: Record<ProjectStatus, { label: string; className: string; icon: IconType }> = {
  // Borrador: gris, con lápiz.
  draft: { label: "Idea por completar", className: "text-slate-200 bg-slate-400/15 ring-slate-300/25", icon: FiEdit3 },
  // Lista para investigar: azul cielo, con palomita.
  structured: { label: "Lista para investigar", className: "text-sky-200 bg-sky-400/15 ring-sky-300/30", icon: FiCheckCircle },
  // Investigando: ámbar, con lupa.
  researching: {
    label: "Investigación en curso",
    className: "text-amber-200 bg-amber-400/15 ring-amber-300/30",
    icon: FiSearch,
  },
  // Resultados listos: verde, con actividad.
  analyzed: {
    label: "Resultados listos",
    className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30",
    icon: FiActivity,
  },
};

/**
 * PROJECT_STATUSES es la lista de las cuatro etapas en orden, sacada de STATUS_META.
 * "Object.keys" devuelve los nombres de las llaves; "as ProjectStatus[]" le dice a TypeScript que son etapas válidas.
 */
/** Define project statuses como dato o funcion publica de projects. */
export const PROJECT_STATUSES = Object.keys(STATUS_META) as ProjectStatus[];

/**
 * ATTRIBUTE_META es el diccionario de las casillas de la idea. Para cada tipo de atributo guarda:
 * - label: su nombre corto (por ejemplo "Problema").
 * - question: la pregunta que se le hace a la persona para llenarlo.
 * - placeholder: un ejemplo que aparece dentro de la casilla antes de escribir.
 * El orden de las líneas es el orden en que aparecen en el formulario.
 */
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

/**
 * ATTRIBUTE_TYPES es la lista de todos los tipos de atributo, en el orden del formulario.
 * Se saca de ATTRIBUTE_META para no tener que escribirla dos veces.
 */
/** Define attribute types como dato o funcion publica de projects. */
export const ATTRIBUTE_TYPES = Object.keys(ATTRIBUTE_META) as AttributeType[];
/**
 * REQUIRED_ATTRIBUTES son los tres datos obligatorios para poder investigar:
 * problema, solución y segmento de clientes. Si falta alguno, el proyecto no pasa a "lista para investigar".
 */
/** Define required attributes como dato o funcion publica de projects. */
export const REQUIRED_ATTRIBUTES: AttributeType[] = ["problem", "solution", "customer_segment"];
