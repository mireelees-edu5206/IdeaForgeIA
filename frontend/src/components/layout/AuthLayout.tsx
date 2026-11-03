/**
 * ARCHIVO: AuthLayout.tsx
 *
 * ¿Qué es?
 * Diseño de las pantallas de inicio de sesión y registro, con presentación visual ilustrada
 * a la izquierda y tarjeta del formulario a la derecha.
 */

import type { ReactNode } from "react";

import {
  CrucibleGlyph,
  FilamentBridgeGlyph,
  HeroIllustration,
  StageSealGlyph,
} from "../ui/ForgeGlyphs";
import { GlassPanel } from "../ui/GlassPanel";
import { Logo } from "../ui/Logo";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Backdrop } from "./Backdrop";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

const FACETS = [
  {
    code: "PASO · 01",
    title: "Organiza tu idea",
    text: "Aclara qué problema quieres resolver y quién lo tiene.",
    tone: "text-kind-evidence",
    status: "researching" as const,
  },
  {
    code: "PASO · 02",
    title: "Busca información",
    text: "Consulta fuentes para conocer el mercado y las opciones actuales.",
    tone: "text-kind-analysis",
    status: "structured" as const,
  },
  {
    code: "PASO · 03",
    title: "Revisa antes de decidir",
    text: "Distingue lo que sabemos de lo que todavía falta comprobar.",
    tone: "text-kind-hypothesis",
    status: "analyzed" as const,
  },
];

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-dvh px-4 py-6 sm:px-6 lg:px-10">
      <Backdrop />
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between pb-6">
        <Logo />
        <ThemeToggle />
      </div>

      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 py-4 lg:grid-cols-[1.15fr_28rem]">
        <section aria-label="Presentación de IdeaForge AI" className="hidden flex-col gap-5 lg:flex">
          <div className="inline-flex items-center gap-3 self-start">
            <span className="neo-raised inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-primary">
              <CrucibleGlyph className="size-4" /> IdeaForge AI · Guía visual para tus ideas
            </span>
            <FilamentBridgeGlyph className="h-4 w-16 text-secondary" />
          </div>

          <h2 className="font-display text-4xl leading-[1.08] font-extrabold tracking-tight xl:text-5xl">
            Decide con más claridad usando <span className="text-gradient">información real</span>.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-slate-300">
            Cuéntanos una idea. Te ayudamos a organizarla, encontrar fuentes y ver qué conviene comprobar.
          </p>

          {/* Ilustración vectorial animada del proceso de validación */}
          <div className="dashboard-hero relative overflow-hidden rounded-3xl p-4">
            <HeroIllustration className="mx-auto h-44 w-full max-w-md" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {FACETS.map(({ code, title: itemTitle, text, tone, status }) => (
              <div key={code} className="surface-panel tilt-3d flex flex-col gap-2.5 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="neo-inset grid size-9 shrink-0 place-items-center rounded-xl">
                    <StageSealGlyph status={status} className={`size-5 ${tone}`} />
                  </span>
                  <span className="font-mono-tech text-[10px] font-semibold tracking-wider text-slate-400">
                    {code}
                  </span>
                </div>
                <h3 className="font-display text-sm font-bold">{itemTitle}</h3>
                <p className="text-xs leading-relaxed text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto w-full max-w-md animate-fade-up">
          <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p>
            <div className="mt-6">{children}</div>
            <div className="mt-5 border-t border-border pt-4 text-center text-sm text-slate-400">
              {footer}
            </div>
          </GlassPanel>
        </div>
      </main>
    </div>
  );
}
