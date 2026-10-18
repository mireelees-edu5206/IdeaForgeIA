import { useOutletContext } from "react-router";

import type { ProjectDetail } from "./types";

export interface ProjectOutletContext {
  project: ProjectDetail;
}

/** Proyecto ya cargado por el layout del detalle (disponible en todas sus pestañas). */
export const useProjectOutlet = () => useOutletContext<ProjectOutletContext>();
