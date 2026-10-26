import { FiActivity, FiPlus, FiShield } from "react-icons/fi";
import { NavLink } from "react-router";

import { useAuth } from "../../features/auth/AuthContext";
import { cn } from "../../lib/cn";
import { LinkButton } from "../ui/LinkButton";
import { Logo } from "../ui/Logo";
import { NAV_ITEMS } from "./navigation";

export function Sidebar() {
  const { user } = useAuth();
  const navItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { to: "/admin", label: "Administración", icon: FiShield }]
      : NAV_ITEMS;

  return (
    <aside className="glass sticky top-4 hidden h-[calc(100dvh-2rem)] flex-col rounded-[1.75rem] p-4 lg:flex">
      <div className="px-1">
        <Logo />
      </div>

      <p className="mt-2 px-1 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
        Investigación inteligente
      </p>

      <LinkButton
        to="/proyectos/nuevo"
        icon={<FiPlus aria-hidden="true" />}
        className="mt-7 w-full justify-center"
      >
        Nueva idea
      </LinkButton>

      <div className="mt-8">
        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
          Tu espacio
        </p>
        <nav aria-label="Navegación principal">
          <ul className="flex flex-col gap-1.5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "group jelly relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                      isActive
                        ? "neo-raised text-accent-cyan ring-1 ring-accent-cyan/25"
                        : "text-slate-300 hover:bg-slate-400/10 hover:text-slate-100",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        aria-hidden="true"
                        className={cn("size-4 shrink-0", isActive ? "text-accent-cyan" : "text-slate-400")}
                      />
                      <span>{label}</span>
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="ml-auto size-1.5 rounded-full bg-accent-cyan shadow-[0_0_10px_var(--color-accent-cyan)]"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-auto rounded-2xl border border-accent-cyan/12 bg-accent-cyan/[0.045] p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <FiActivity aria-hidden="true" className="size-4 text-accent-cyan" />
          Evidencia rastreable
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Cada conclusión conserva su fuente y distingue los hechos de las interpretaciones.
        </p>
      </div>
    </aside>
  );
}
