import { useEffect } from "react";
import { FiPlus, FiShield, FiX } from "react-icons/fi";
import { NavLink } from "react-router";

import { cn } from "../../lib/cn";
import { LinkButton } from "../ui/LinkButton";
import { Logo } from "../ui/Logo";
import { NAV_ITEMS } from "./navigation";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "jelly flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition",
                isActive
                  ? "neo-raised text-slate-100 ring-1 ring-accent-cyan/30"
                  : "text-slate-300 hover:bg-slate-400/10 hover:text-slate-100",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg transition",
                    isActive ? "bg-accent-cyan/15 text-accent-cyan" : "bg-slate-400/10 text-slate-400",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="px-1 pt-1">
        <Logo />
      </div>

      <LinkButton
        to="/proyectos/nuevo"
        onClick={onNavigate}
        icon={<FiPlus aria-hidden="true" />}
        className="w-full justify-center"
      >
        Nueva idea
      </LinkButton>

      <nav aria-label="Navegación principal">
        <NavList onNavigate={onNavigate} />
      </nav>

      <div className="neo-inset mt-auto flex items-start gap-2.5 rounded-2xl p-3.5 text-xs text-slate-300">
        <FiShield aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-cyan" />
        <p className="leading-relaxed">
          Cada conclusión distingue <strong className="text-slate-100">datos</strong>,{" "}
          <strong className="text-slate-100">evidencia</strong> e{" "}
          <strong className="text-slate-100">interpretación</strong>.
        </p>
      </div>
    </div>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onClose]);

  return (
    <>
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-64 flex-col rounded-3xl p-4 lg:flex">
        <SidebarContent />
      </aside>

      <div
        className={cn("fixed inset-0 z-40 lg:hidden", mobileOpen ? "visible" : "invisible")}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
        />
        <aside
          id="mobile-navigation"
          className={cn(
            "glass absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col rounded-r-3xl p-4 transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="jelly grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-slate-400/10"
            >
              <FiX aria-hidden="true" className="size-5" />
            </button>
          </div>
          <SidebarContent onNavigate={onClose} />
        </aside>
      </div>
    </>
  );
}
