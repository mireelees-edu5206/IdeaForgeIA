/**
 * ARCHIVO: frontend/src/lib/useDocumentTitle.ts
 *
 * ¿Qué es?
 * Un "hook" (una función especial de React que empieza con "use") que cambia el título de la pestaña
 * del navegador según la pantalla que se está viendo.
 *
 * ¿Para qué sirve?
 * Para que cada pantalla tenga su propio título, por ejemplo "Proyectos · IdeaForge AI". Así es
 * más fácil distinguir pestañas abiertas.
 *
 * ¿Quién lo usa?
 * Las páginas de la app (y StatusPage.tsx para las pantallas de error).
 *
 * Uso típico dentro de una página:
 *   useDocumentTitle("Proyectos");
 */
import { useEffect } from "react";

/**
 * Cambia document.title cada vez que cambia el texto recibido.
 *
 * @param title El nombre de la pantalla, sin el sufijo de la app.
 */
export function useDocumentTitle(title: string): void {
  // useEffect ejecuta el cambio DESPUÉS de dibujar la pantalla, no durante el dibujo.
  // La lista [title] al final indica que solo se vuelve a ejecutar si el título cambia.
  useEffect(() => {
    // "·" es un separador visual entre el nombre de la pantalla y el nombre de la app.
    document.title = `${title} · IdeaForge AI`;
  }, [title]);
}
