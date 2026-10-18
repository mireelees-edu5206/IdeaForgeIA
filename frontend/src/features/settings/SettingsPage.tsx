import { useState } from "react";
import { FiCheck, FiLogOut, FiMail, FiMoon, FiShield, FiSun, FiUser } from "react-icons/fi";

import { Button } from "../../components/ui/Button";
import { InstallPwaCard } from "../../components/layout/InstallPwaCard";
import { CrucibleGlyph } from "../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { type ThemeMode, applyTheme, readInitialTheme } from "../../components/ui/ThemeToggle";
import { cn } from "../../lib/cn";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../projects/components/PageHeader";

const THEME_OPTIONS: Array<{
  mode: ThemeMode;
  title: string;
  subtitle: string;
  previewClass: string;
  icon: typeof FiSun;
}> = [
  {
    mode: "light",
    title: "Modo claro",
    subtitle: "Superficie blanca limpia y tarjetas cristalinas con tonos violeta suaves.",
    previewClass: "bg-[#fbfaff] text-[#170e2c] border-violet-300/60",
    icon: FiSun,
  },
  {
    mode: "dark",
    title: "Modo oscuro",
    subtitle: "Superficie oscura amatista con paneles translúcidos y acentos violeta.",
    previewClass: "bg-[#080414] text-[#f3ecff] border-violet-400/40",
    icon: FiMoon,
  },
];

export function SettingsPage() {
  useDocumentTitle("Configuración");
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [leaving, setLeaving] = useState(false);
  const initial = user?.full_name.trim().charAt(0).toUpperCase() ?? "?";

  function selectTheme(next: ThemeMode) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
        <PageHeader
          eyebrow="Preferencias y cuenta"
          title="Configuración"
          description="Administra tu perfil, elige la atmósfera visual del observatorio y gestiona tu sesión."
        />
      </GlassPanel>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1.2fr]">
        {/* Perfil, correo y cierre de sesión */}
        <GlassPanel className="flex flex-col justify-between gap-6 rounded-3xl p-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="neo-raised font-display grid size-14 shrink-0 place-items-center rounded-2xl text-xl font-bold text-accent-cyan ring-1 ring-accent-cyan/30"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="font-mono-tech text-[11px] font-semibold tracking-wider text-accent-cyan uppercase">
                  Cuenta activa
                </p>
                <h2 className="font-display truncate text-xl font-bold">{user?.full_name}</h2>
              </div>
            </div>

            <dl className="flex flex-col gap-3">
              <div className="neo-inset flex items-center gap-3 rounded-2xl p-3.5">
                <FiUser aria-hidden="true" className="size-4 shrink-0 text-accent-cyan" />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Nombre completo</dt>
                  <dd className="truncate text-sm font-semibold text-slate-100">{user?.full_name}</dd>
                </div>
              </div>

              <div className="neo-inset flex items-center gap-3 rounded-2xl p-3.5">
                <FiMail aria-hidden="true" className="size-4 shrink-0 text-accent-cyan" />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Correo electrónico</dt>
                  <dd className="truncate text-sm font-semibold text-slate-100">{user?.email}</dd>
                </div>
              </div>

              <div className="neo-inset flex items-center gap-3 rounded-2xl p-3.5">
                <FiShield aria-hidden="true" className="size-4 shrink-0 text-accent-violet" />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Rol en la plataforma</dt>
                  <dd className="text-sm font-semibold text-slate-100">
                    {user?.role === "admin" ? "Administrador" : "Investigador"}
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-400/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Cierra tu sesión en este dispositivo cuando termines de trabajar.
            </p>
            <Button
              variant="danger"
              loading={leaving}
              icon={<FiLogOut aria-hidden="true" />}
              onClick={() => {
                setLeaving(true);
                void logout();
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </GlassPanel>

        {/* Selector visual de apariencia (Modo Claro vs Modo Oscuro) */}
        <GlassPanel className="flex flex-col gap-5 rounded-3xl p-6">
          <div className="flex items-center gap-2.5">
            <CrucibleGlyph className="size-5 text-accent-cyan" />
            <div>
              <h2 className="font-display text-lg font-bold">Apariencia de la interfaz</h2>
              <p className="text-xs text-slate-400">
                El cambio se aplica al instante y se guarda en este navegador.
              </p>
            </div>
          </div>

          <div role="radiogroup" aria-label="Tema de la interfaz" className="grid gap-3.5">
            {THEME_OPTIONS.map(({ mode, title, subtitle, previewClass, icon: Icon }) => {
              const active = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectTheme(mode)}
                  className={cn(
                    "tilt-3d jelly flex items-start gap-4 rounded-2xl p-4 text-left transition",
                    active
                      ? "neo-raised ring-2 ring-accent-cyan"
                      : "neo-inset opacity-85 hover:opacity-100",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-xl border",
                      previewClass,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{title}</span>
                      {active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-cyan/15 px-2.5 py-0.5 text-xs font-semibold text-accent-cyan">
                          <FiCheck aria-hidden="true" className="size-3.5" /> Activo
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">{subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </div>
      <InstallPwaCard />
    </div>
  );
}
