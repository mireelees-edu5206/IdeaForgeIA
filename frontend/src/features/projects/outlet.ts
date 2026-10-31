/**
 * ARCHIVO: projects/outlet.ts
 *
 * ¿Qué es?
 * Es el "pase" que el detalle del proyecto da a sus pestañas. La pantalla de detalle carga el
 * proyecto una sola vez y lo deja disponible para todas las pestañas hijas (Investigación,
 * Hallazgos, Análisis...), sin que cada una tenga que volver a pedirlo.
 *
 * ¿Para qué sirve?
 * - ProjectOutletContext: describe qué "paquete" viaja al hijo (el proyecto).
 * - useProjectOutlet(): permite a una pestaña abrir ese paquete y leer el proyecto.
 *
 * ¿Quién lo usa?
 * ProjectDetailPage.tsx entrega el proyecto. Las pestañas (ResearchTab, FindingsTab, etc.) lo leen con useProjectOutlet().
 */

/* "useOutletContext" lee el paquete que el padre entregó a sus hijos (en React Router, el "Outlet"). */
import { useOutletContext } from "react-router";

/* La ficha de forma del proyecto completo. */
import type { ProjectDetail } from "./types";

/**
 * ProjectOutletContext describe el paquete: un solo dato, "project", que es el proyecto completo.
 */
/** Describe el contrato project outlet context utilizado por projects. */
export interface ProjectOutletContext {
  project: ProjectDetail;
}

/**
 * useProjectOutlet devuelve el paquete para usarlo en una pestaña.
 *
 * Cómo se usa: const { project } = useProjectOutlet();
 *
 * Nota: solo funciona dentro de una pestaña del detalle del proyecto. Fuera de ahí, no hay paquete.
 */
/** Proyecto ya cargado por el layout del detalle (disponible en todas sus pestañas). */
export const useProjectOutlet = () => useOutletContext<ProjectOutletContext>();
