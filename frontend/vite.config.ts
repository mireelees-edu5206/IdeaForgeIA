/** Configura plugins de Vite, proxy local y entorno de pruebas Vitest. */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Plugins que transforman JSX y las clases/tokens de Tailwind.
  plugins: [react(), tailwindcss()],
  // Ajustes del servidor local; el proxy evita CORS durante desarrollo.
  server: {
    port: 5173,
    strictPort: true,
    // En desarrollo, /api se redirige al backend: mismo origen, sin CORS.
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  // Entorno de pruebas de componentes y setup global de Vitest.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
});
