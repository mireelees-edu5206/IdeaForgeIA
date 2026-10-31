/**
 * ARCHIVO: projects/routes.tsx
 *
 * ¿Qué es?
 * Es el "mapa de pestañas" del detalle de un proyecto. Dice qué pantalla se muestra en cada
 * dirección dentro de un proyecto. Por ejemplo, "/proyectos/123/hallazgos" muestra las pestañas
 * de Hallazgos dentro del detalle del proyecto 123.
 *
 * ¿Para qué sirve?
 * Une las direcciones (URL) con las pantallas. La pantalla padre (ProjectDetailPage) se dibuja
 * siempre; la pestaña que corresponde a la dirección se dibuja dentro de su hueco ("Outlet").
 *
 * La lista de hijos:
 * - "index" (sin nombre de pestaña): la idea del proyecto (ProjectIdeaTab), la pestaña por defecto.
 * - "investigacion", "hallazgos", "competidores", "analisis", "asistente", "fuentes",
 *   "visualizaciones", "reportes": cada una es una pestaña.
 *
 * ¿Quién lo usa?
 * app/router.tsx lo incluye en la app, y también las pruebas (projects.test.tsx) para simular las rutas.
 *
 * ⚠ Si agregas una pestaña: crea la pantalla, agrégala aquí con su "path" y revisa que el menú
 * de pestañas de ProjectDetailPage.tsx también la muestre.
 */

/* "RouteObject" es la forma que tiene una ruta en React Router (dirección, pantalla y pestañas hijas). */
import type { RouteObject } from "react-router";

/* Las pantallas de cada pestaña. Cada una vive en su propia carpeta de features. */
import { AnalysisTab } from "../analysis/AnalysisTab";
import { ChatTab } from "../chat/ChatTab";
import { CompetitorsTab } from "../findings/CompetitorsTab";
import { FindingsTab } from "../findings/FindingsTab";
import { ResearchTab } from "../research/ResearchTab";
import { SourcesTab } from "../research/SourcesTab";
import { ReportsTab } from "../reports/ReportsTab";
import { VisualizationsTab } from "../visualizations/VisualizationsTab";
/* La pantalla del detalle (el marco del proyecto) y la pestaña de la idea. Ambas viven en esta carpeta. */
import { ProjectDetailPage } from "./ProjectDetailPage";
import { ProjectIdeaTab } from "./ProjectIdeaTab";

/**
 * projectDetailRoute es la ruta completa del detalle de un proyecto.
 * - path "/proyectos/:projectId": el ":projectId" es un hueco: aquí va el id real del proyecto.
 * - element: la pantalla padre (el marco con el encabezado y el menú de pestañas).
 * - children: las pestañas. Cada una tiene una dirección ("path") y una pantalla ("element").
 * "index: true" significa "la pestaña que se muestra cuando la dirección no tiene pestaña extra".
 */
/** Detalle del proyecto con sus pestañas (compartido por el router de la app y los tests). */
export const projectDetailRoute: RouteObject = {
  path: "/proyectos/:projectId",
  element: <ProjectDetailPage />,
  children: [
    // Pestaña de la idea (la que se ve al abrir el proyecto).
    { index: true, element: <ProjectIdeaTab /> },
    // Pestaña de investigación: preguntas, progreso y respuestas con fuentes.
    { path: "investigacion", element: <ResearchTab /> },
    // Pestaña de hallazgos: resultados encontrados con su evidencia.
    { path: "hallazgos", element: <FindingsTab /> },
    // Pestaña de competidores: alternativas parecidas o sustitutas.
    { path: "competidores", element: <CompetitorsTab /> },
    // Pestaña de análisis: oportunidades, riesgos, hipótesis e información faltante.
    { path: "analisis", element: <AnalysisTab /> },
    // Pestaña del asistente: preguntas sobre el proyecto.
    { path: "asistente", element: <ChatTab /> },
    // Pestaña de fuentes: todos los sitios consultados.
    { path: "fuentes", element: <SourcesTab /> },
    // Pestaña de visualizaciones: gráficas con datos reales del proyecto.
    { path: "visualizaciones", element: <VisualizationsTab /> },
    // Pestaña de informes: el veredicto final y el informe completo.
    { path: "reportes", element: <ReportsTab /> },
  ],
};
