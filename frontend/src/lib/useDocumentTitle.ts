/** Actualiza el titulo del navegador por pantalla. */
import { useEffect } from "react";

/** Expone la funcion use document title para el flujo de shared frontend. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · IdeaForge AI`;
  }, [title]);
}
