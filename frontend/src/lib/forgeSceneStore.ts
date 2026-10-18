export type ForgeMode = "auth" | "dashboard" | "portfolio" | "composer" | "workspace";

export interface ForgeSceneState {
  mode: ForgeMode;
  /** 0..1: temperatura/formación del núcleo (porcentaje de escritura o avance del proyecto). */
  heat: number;
  /** 0..3: facetas obligatorias confirmadas en el proyecto activo. */
  litFacets: number;
  /** 0..6: índice de etapa activa en el workspace. */
  stageIndex: number;
}

let state: ForgeSceneState = {
  mode: "dashboard",
  heat: 0.35,
  litFacets: 1,
  stageIndex: 0,
};

const listeners = new Set<() => void>();

export const forgeSceneStore = {
  get: (): ForgeSceneState => state,
  set: (patch: Partial<ForgeSceneState>): void => {
    const next = { ...state, ...patch };
    if (
      next.mode === state.mode &&
      next.heat === state.heat &&
      next.litFacets === state.litFacets &&
      next.stageIndex === state.stageIndex
    ) {
      return;
    }
    state = next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
