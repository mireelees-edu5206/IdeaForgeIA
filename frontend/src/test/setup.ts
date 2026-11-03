/**
 * ARCHIVO: frontend/src/test/setup.ts
 *
 * ¿Qué es?
 * Un archivo de preparación que Vitest ejecuta ANTES de cada archivo de pruebas (así lo indica
 * vite.config.ts). Prepara el entorno para que las pruebas se comporten igual entre sí.
 *
 * ¿Qué hace?
 * 1. Importa jest-dom, que agrega comparaciones fáciles para el DOM (por ejemplo, toBeInTheDocument()).
 * 2. Después de cada prueba (afterEach):
 *    - cleanup(): desmonta lo que la prueba dibujó, para que una prueba no vea restos de otra.
 *    - localStorage.clear(): borra lo guardado en el navegador simulado (sesión, tema, etc.).
 *
 * Sin esto, las pruebas podrían pasar o fallar dependiendo del orden en que se ejecutan.
 *
 * ¿Quién lo usa?
 * Vitest, automáticamente. Ningún archivo lo importa.
 */

// Agrega matchers como toBeInTheDocument() y toHaveTextContent() a expect().
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// "afterEach" registra un bloque que se ejecuta al terminar cada prueba.
afterEach(() => {
  // Quita del DOM simulado todo lo que dibujó la prueba.
  cleanup();
  // Vacía el almacenamiento local simulado para que no quede la sesión ni el tema de la prueba anterior.
  localStorage.clear();
});
