/**
 * ARCHIVO: frontend/src/main.tsx
 *
 * ¿Qué es?
 * El punto de entrada de la aplicación. Es el primer archivo de JavaScript que el navegador ejecuta
 * (Vite lo indica en index.html).
 *
 * ¿Para qué sirve?
 * Hace tres cosas:
 * 1. Carga los estilos globales (index.css), para que existan antes de dibujar nada.
 * 2. Busca en index.html el elemento con id "root" y dibuja la aplicación dentro.
 * 3. En producción, registra el Service Worker: el archivo que permite usar la app sin conexión
 *    y instalarla como PWA.
 *
 * ¿Quién lo usa?
 * El navegador, a través de index.html. Nadie lo importa.
 */
import "./styles/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";

// Busca en index.html el contenedor vacío <div id="root"></div>, donde se dibuja toda la app.
const root = document.getElementById("root");
// Si no existe, la app no tiene dónde dibujarse: se detiene con un error claro.
if (!root) throw new Error("No se encontró el elemento #root.");

// createRoot prepara el contenedor para dibujar React. render() dibuja la app dentro.
// StrictMode no cambia lo que se ve; en desarrollo avisa de malas prácticas y ejecuta ciertos efectos dos veces.
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El Service Worker solo se registra en producción (ya desplegada), no mientras se programa.
// "serviceWorker" in navigator comprueba que el navegador lo soporte.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Se espera a que la página termine de cargar para no competir con la carga inicial.
  window.addEventListener("load", () => {
    // El registro puede fallar (por ejemplo, sin HTTPS). Ese error se ignora: la app sigue funcionando sin caché offline.
    void navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
  });
}
