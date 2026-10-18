import { FiPlus, FiShield, FiSliders } from "react-icons/fi";
import { NavLink } from "react-router";

import { useAuth } from "../../features/auth/AuthContext";
import { cn } from "../../lib/cn";
import { LinkButton } from "../ui/LinkButton";
import { Logo } from "../ui/Logo";
import { NAV_ITEMS } from "./navigation";

export function Topbar() {
  const { user } = useAuth();
  const initial = user?.full_name.trim().charAt(0).toUpperCase() ?? "?";
  const firstName = user?.full_name.trim().split(" ")[0] ?? "Cuenta";
  const navItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: FiShield }]
      : NAV_ITEMS;

  return (
    <>
      <header className="glass sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3 sm:px-5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="neo-inset hidden items-center gap-2 rounded-full px-3 py-1 text-xs text-slate-300 xl:inline-flex">
            <span className="size-2 rounded-full bg-emerald-300" aria-hidden="true" />
            Observatorio de ideas
          </span>
        </div>

        <nav
          aria-label="Navegación principal"
          className="neo-inset hidden items-center gap-1.5 rounded-2xl p-1.5 md:flex"
        >
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "jelly inline-flex h-10 items-center gap-2.5 rounded-xl px-4 text-sm font-medium transition",
                  isActive
                    ? "neo-raised text-slate-100 ring-1 ring-accent-cyan/35"
                    : "text-slate-300 hover:bg-slate-400/10 hover:text-slate-100",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon aria-hidden="true" className={cn("size-4", isActive && "text-accent-cyan")} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <LinkButton
            to="/proyectos/nuevo"
            size="sm"
            icon={<FiPlus aria-hidden="true" />}
            className="hidden sm:inline-flex"
          >
            Nueva idea
          </LinkButton>
          <NavLink
            to="/configuracion"
            aria-label="Configuración y cuenta"
            className={({ isActive }) =>
              cn(
                "jelly neo-raised inline-flex h-10 items-center gap-2.5 rounded-2xl pr-3.5 pl-2 text-xs font-semibold transition",
                isActive ? "ring-2 ring-accent-cyan text-accent-cyan" : "text-slate-200 hover:text-accent-cyan",
              )
            }
          >
            <span
              aria-hidden="true"
              className="neo-inset grid size-7 place-items-center rounded-xl text-xs font-bold text-accent-cyan"
            >
              {initial}
            </span>
            <span className="hidden sm:inline">{firstName}</span>
            <FiSliders aria-hidden="true" className="size-3.5 text-slate-400" />
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
                "jelly flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-[11px] font-medium",
                isActive ? "neo-raised text-accent-cyan" : "text-slate-300",
              )
            }
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/proyectos/nuevo"
          className="jelly flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-linear-to-r from-accent-cyan to-accent-violet px-1.5 py-2.5 text-[11px] font-semibold text-white"
        >
          <FiPlus aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Nueva</span>
        </NavLink>
      </nav>
    </>
  );
}
