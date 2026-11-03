/**
 * ARCHIVO: frontend/src/app/App.tsx
 *
 * ¿Qué es?
 * El componente raíz de la aplicación. Es la "caja" más externa de todo lo que ves en pantalla:
 * dentro de ella viven el sistema de caché de datos, la sesión del usuario y el enrutador de páginas.
 *
 * ¿Para qué sirve?
 * Para envolver la app en tres capas, en este orden:
 *   1. QueryClientProvider: guarda los datos que llegan del servidor (proyectos, hallazgos...) y
 *      decide cuándo volver a pedirlos.
 *   2. AuthProvider: sabe si hay alguien conectado y comparte esa información con toda la app.
 *   3. RouterProvider: decide qué página mostrar según la dirección del navegador.
 * El orden importa: AuthProvider usa la caché de datos, por eso debe quedar dentro de QueryClientProvider.
 *
 * ¿Quién lo usa?
 * main.tsx lo monta dentro de <StrictMode> y lo pone en el elemento #root del HTML.
 *
 * Partes principales:
 * - useState(createQueryClient): crea la caché una sola vez. Pasarle la función (sin paréntesis) evita
 *   que se cree una caché nueva en cada redibujado.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";

import { AuthProvider } from "../features/auth/AuthProvider";
import { createQueryClient } from "../lib/queryClient";
import { router } from "./router";

/**
 * Componente raíz. No recibe props: todo lo que necesita sale de los módulos que importa.
 * Devuelve el árbol de proveedores con la página actual adentro.
 */
export function App() {
  // La caché se crea una sola vez y se guarda en estado. Así sobrevive a los redibujados.
  const [queryClient] = useState(createQueryClient);
  return (
    // La caché queda disponible para todos los componentes de dentro.
    <QueryClientProvider client={queryClient}>
      {/* AuthProvider escucha la sesión de Supabase y expone useAuth() a toda la app. */}
      <AuthProvider>
        {/* RouterProvider renderiza la ruta que coincida con la dirección actual. */}
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
