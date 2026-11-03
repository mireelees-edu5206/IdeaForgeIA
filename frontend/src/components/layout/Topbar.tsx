/**
 * ARCHIVO: Topbar.tsx
 *
 * ¿Qué es?
 * Barra de navegación superior unificada tipo Dock:
 * - Izquierda: Logo de IdeaForge Studio + indicador de sección actual.
 * - Centro (en escritorio/tablet): Píldora de navegación con Panel, Proyectos, Configuración y Administración.
 * - Derecha: Botón "+ Nueva idea", selector de tema y perfil del usuario.
 * - Móvil: Barra inferior flotante para pulgar.
 */

import { FiPlus, FiShield, FiSliders } from "react-icons/fi";
import { NavLink } from "react-router";

import { useAuth } from "../../features/auth/AuthContext";
import { cn } from "../../lib/cn";
import { LinkButton } from "../ui/LinkButton";
import { Logo } from "../ui/Logo";
import { ThemeToggle } from "../ui/ThemeToggle";
import { NAV_ITEMS } from "./navigation";

export function Topbar() {
  const { user } = useAuth();
  const initial = user?.full_name.trim().charAt(0).toUpperCase() ?? "?";
  const firstName = user?.full_name.trim().split(" ")[0] ?? "Cuenta";

  const desktopNavItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { to: "/admin", label: "Administración", icon: FiShield }]
      : NAV_ITEMS;

  const mobileNavItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: FiShield }]
      : NAV_ITEMS;

  return (
    <>
      <header className="surface-panel sticky top-3 z-30 flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
        {/* Izquierda: Logo en una sola línea limpia */}
        <div className="flex shrink-0 items-center">
          <Logo />
        </div>

        {/* Centro: Navegación principal en píldora (escritorio/tablet) */}
        <nav aria-label="Navegación principal" className="hidden md:block">
          <ul className="neo-inset flex items-center gap-1 rounded-xl p-1">
            {desktopNavItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "jelly flex min-h-9 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm",
                      isActive
                        ? "bg-card text-primary shadow-sm ring-1 ring-border"
                        : "text-slate-300 hover:text-slate-100",
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Derecha: Acción principal, tema y cuenta */}
        <div className="flex shrink-0 items-center gap-2">
          <LinkButton
            to="/proyectos/nuevo"
            size="sm"
            icon={<FiPlus aria-hidden="true" />}
            className="hidden sm:inline-flex"
          >
            Nueva idea
          </LinkButton>
          <ThemeToggle />
          <NavLink
            to="/configuracion"
            aria-label={`Cuenta de ${firstName}; abrir configuración`}
            className={({ isActive }) =>
              cn(
                "jelly neo-raised inline-flex min-h-10 min-w-10 items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold transition sm:pr-3",
                isActive ? "ring-2 ring-primary text-primary" : "text-slate-200 hover:text-primary",
              )
            }
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary"
            >
              {initial}
            </span>
            <span className="hidden sm:inline">{firstName}</span>
            <FiSliders aria-hidden="true" className="hidden size-3.5 text-slate-400 sm:block" />
          </NavLink>
        </div>
      </header>

      {/* Barra inferior para móvil */}
      <nav
        aria-label="Acceso rápido móvil"
        className="surface-panel fixed inset-x-2 bottom-2 z-30 flex items-center justify-around gap-1 rounded-2xl p-1.5 shadow-lg md:hidden"
      >
        {mobileNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "jelly flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium",
                isActive ? "bg-primary/12 font-semibold text-primary" : "text-slate-300",
              )
            }
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/proyectos/nuevo"
          className="jelly liquid-btn-primary flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-semibold text-white"
        >
          <FiPlus aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Nueva</span>
        </NavLink>
      </nav>
    </>
  );
}
