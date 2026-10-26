import { FiPlus, FiShield, FiSliders } from "react-icons/fi";
import { NavLink, useLocation } from "react-router";

import { useAuth } from "../../features/auth/AuthContext";
import { cn } from "../../lib/cn";
import { LinkButton } from "../ui/LinkButton";
import { Logo } from "../ui/Logo";
import { ThemeToggle } from "../ui/ThemeToggle";
import { NAV_ITEMS } from "./navigation";

function pageLabel(pathname: string): string {
  if (pathname === "/") return "Panel";
  if (pathname === "/proyectos") return "Proyectos";
  if (pathname === "/proyectos/nuevo") return "Nuevo proyecto";
  if (pathname.startsWith("/proyectos/")) return "Área de proyecto";
  if (pathname.startsWith("/admin")) return "Administración";
  if (pathname === "/configuracion") return "Configuración";
  return "IdeaForge";
}

export function Topbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const initial = user?.full_name.trim().charAt(0).toUpperCase() ?? "?";
  const firstName = user?.full_name.trim().split(" ")[0] ?? "Cuenta";
  const navItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: FiShield }]
      : NAV_ITEMS;

  return (
    <>
      <header className="glass sticky top-3 z-30 flex min-h-[4.25rem] items-center justify-between gap-2 rounded-2xl px-3 py-2.5 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="lg:hidden">
            <Logo compact />
          </span>
          <span className="hidden h-8 w-px bg-border lg:block" aria-hidden="true" />
          <div className="min-w-0">
            <p className="hidden text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:block">
              IdeaForge <span className="px-1 text-accent">/</span> Investigación de negocio
            </p>
            <p className="truncate text-sm font-semibold text-slate-100 sm:text-base">{pageLabel(pathname)}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LinkButton
            to="/proyectos/nuevo"
            size="sm"
            icon={<FiPlus aria-hidden="true" />}
            className="hidden md:inline-flex"
          >
            Nueva idea
          </LinkButton>
          <ThemeToggle />
          <NavLink
            to="/configuracion"
            aria-label={`Cuenta de ${firstName}; abrir configuración`}
            className={({ isActive }) =>
              cn(
                "jelly neo-raised inline-flex min-h-11 min-w-11 items-center gap-2 rounded-xl px-1.5 py-1.5 text-xs font-semibold transition sm:pr-3",
                isActive ? "ring-2 ring-accent-cyan text-accent-cyan" : "text-slate-200 hover:text-accent-cyan",
              )
            }
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary"
            >
              {initial}
            </span>
            <span className="hidden sm:inline">{firstName}</span>
            <FiSliders aria-hidden="true" className="hidden size-3.5 text-slate-400 sm:block" />
          </NavLink>
        </div>
      </header>

      <nav
        aria-label="Acceso rápido móvil"
        className="glass fixed inset-x-2 bottom-2 z-30 flex items-center justify-around gap-1 rounded-2xl p-1.5 md:hidden"
      >
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "jelly flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium",
                isActive ? "neo-raised text-primary" : "text-slate-300",
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
