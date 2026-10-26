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

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: LOGIN_PATH, element: <LoginPage /> },
          { path: "/registro", element: <RegisterPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "/",
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "proyectos", element: <ProjectsPage /> },
              { path: "proyectos/nuevo", element: <NewProjectPage /> },
              { path: "configuracion", element: <SettingsPage /> },
              {
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
              projectDetailRoute,
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
