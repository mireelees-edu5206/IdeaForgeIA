import type { RouteObject } from "react-router";

import { AnalysisTab } from "../analysis/AnalysisTab";
import { ChatTab } from "../chat/ChatTab";
import { CompetitorsTab } from "../findings/CompetitorsTab";
import { FindingsTab } from "../findings/FindingsTab";
import { ResearchTab } from "../research/ResearchTab";
import { SourcesTab } from "../research/SourcesTab";
import { ReportsTab } from "../reports/ReportsTab";
import { ProjectDetailPage } from "./ProjectDetailPage";
import { ProjectIdeaTab } from "./ProjectIdeaTab";

/** Detalle del proyecto con sus pestañas (compartido por el router de la app y los tests). */
export const projectDetailRoute: RouteObject = {
  path: "/proyectos/:projectId",
  element: <ProjectDetailPage />,
  children: [
    { index: true, element: <ProjectIdeaTab /> },
    { path: "investigacion", element: <ResearchTab /> },
    { path: "hallazgos", element: <FindingsTab /> },
    { path: "competidores", element: <CompetitorsTab /> },
    { path: "analisis", element: <AnalysisTab /> },
    { path: "asistente", element: <ChatTab /> },
    { path: "fuentes", element: <SourcesTab /> },
    { path: "reportes", element: <ReportsTab /> },
  ],
};
