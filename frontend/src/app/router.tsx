/**
 * ARCHIVO: frontend/src/app/router.tsx
 *
 * ¿Qué es?
 * El mapa de la aplicación. Dice qué página se muestra para cada dirección (URL), y quién puede verla.
 *
 * ¿Para qué sirve?
 * Para que cada dirección lleve a la pantalla correcta y para proteger las pantallas privadas:
 * - Solo invitados (sin sesión): inicio de sesión y registro.
 * - Solo personas conectadas: el panel principal, proyectos, configuración y el detalle de cada proyecto.
 * - Solo administradoras: el panel de administración y el laboratorio.
 *
 * ¿Cómo funciona?
 * createBrowserRouter recibe una lista de rutas anidadas. Cada objeto puede tener:
 * - path: la dirección que se compara con la barra del navegador.
 * - element: el componente que se dibuja.
 * - children: rutas hijas que heredan la protección del padre.
 * - errorElement: lo que se muestra si una página lanza un error inesperado.
 * Los objetos sin "path" son "rutas de diseño": solo sirven para agrupar y aplicar una barrera
 * (como <RequireAuth />) sin añadir una dirección nueva.
 *
 * ¿Quién lo usa?
 * App.tsx pasa este router a RouterProvider.
 *
 * Para agregar una pantalla nueva: crea su componente, agrega una línea con su path y su element en el
 * grupo que corresponda (público, privado o admin).
 */
import { createBrowserRouter } from "react-router";

import { AppShell } from "../components/layout/AppShell";
import { AdminPage } from "../features/admin/AdminPage";
import { AdminLabLogicPage } from "../features/admin/lab/AdminLabLogicPage";
import { AdminLabPage } from "../features/admin/lab/AdminLabPage";
import { GuestOnly, LOGIN_PATH, RequireAdmin, RequireAuth } from "../features/auth/guards";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { NewProjectPage } from "../features/projects/NewProjectPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { projectDetailRoute } from "../features/projects/routes";
import { SettingsPage } from "../features/settings/SettingsPage";
import { NotFoundPage, RouteErrorPage } from "../pages/StatusPage";

/**
 * El enrutador completo de la aplicación. Es un dato, no un componente: lo usa App.tsx.
 *
 * La ruta más externa tiene "errorElement": si cualquier página de dentro falla, se muestra
 * RouteErrorPage en lugar de una pantalla en blanco.
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        // Solo para invitados: si ya hay sesión, GuestOnly manda a la persona al panel.
        element: <GuestOnly />,
        children: [
          { path: LOGIN_PATH, element: <LoginPage /> },
          { path: "/registro", element: <RegisterPage /> },
        ],
      },
      {
        // Solo para personas conectadas: si no hay sesión, RequireAuth manda a iniciar sesión.
        element: <RequireAuth />,
        children: [
          {
            // AppShell es la carcasa común (menú lateral, barra superior). Las páginas de dentro se dibujan en su interior.
            path: "/",
            element: <AppShell />,
            children: [
              // "index" es la página de inicio: se muestra cuando la dirección es exactamente "/".
              { index: true, element: <DashboardPage /> },
              { path: "proyectos", element: <ProjectsPage /> },
              { path: "proyectos/nuevo", element: <NewProjectPage /> },
              { path: "configuracion", element: <SettingsPage /> },
              {
                // Solo administradoras: RequireAdmin muestra "sin permiso" a los demás.
                element: <RequireAdmin />,
                children: [
                  { path: "admin", element: <AdminPage /> },
                  { path: "admin/laboratorio", element: <AdminLabPage /> },
                  {
                    path: "admin/laboratorio/proposiciones",
                    element: <AdminLabLogicPage />,
                  },
                ],
              },
              // Las pantallas de un proyecto concreto (/proyectos/:projectId) viven en su propio archivo.
              projectDetailRoute,
            ],
          },
        ],
      },
      // Cualquier dirección que no coincida con las anteriores muestra la página 404.
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
