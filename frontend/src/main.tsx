/** Inicia React y registra el Service Worker en produccion. */
import "./styles/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";

/** Define root para el bloque de aplicacion. */
const root = document.getElementById("root");
/** Rama condicional: !root. */
if (!root) throw new Error("No se encontró el elemento #root.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/** Rama condicional: import.meta.env.PROD && "serviceWorker" in navigator. */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
  });
}
