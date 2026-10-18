import type { ReactNode } from "react";

import { CrucibleGlyph, FilamentBridgeGlyph, StageSealGlyph } from "../ui/ForgeGlyphs";
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
    code: "FACETA · I",
    title: "Trazabilidad verificable",
    text: "Cada hallazgo conserva el hilo hacia su fragmento citado y el dominio de origen.",
    tone: "text-kind-evidence",
    status: "researching" as const,
  },
  {
    code: "FACETA · II",
    title: "Hecho vs. interpretación",
    text: "Datos del usuario, evidencia empírica y análisis de IA nunca se mezclan.",
    tone: "text-kind-analysis",
    status: "structured" as const,
  },
  {
    code: "FACETA · III",
    title: "Incertidumbre explícita",
    text: "Lo no comprobado se declara como hipótesis o vacío de información, no como certeza.",
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
        <section aria-label="Presentación de IdeaForge AI" className="hidden flex-col gap-6 lg:flex">
          <div className="inline-flex items-center gap-3 self-start">
            <span className="neo-raised inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-accent-cyan">
              <CrucibleGlyph className="size-4" /> La Forja Viva · Laboratorio de Validación
            </span>
            <FilamentBridgeGlyph className="h-4 w-16 text-accent-violet" />
          </div>

          <h2 className="font-display text-4xl leading-[1.08] font-bold tracking-tight xl:text-5xl">
            Forja tu idea con <span className="text-gradient">evidencia real</span>, no con suposiciones.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-slate-300">
            Somete cualquier hipótesis de negocio a contraste empírico: qué se encontró, de dónde salió, qué tan
            confiable es y qué sigue oculto en la niebla.
          </p>

          <div className="grid gap-3.5">
            {FACETS.map(({ code, title: itemTitle, text, tone, status }) => (
              <div key={code} className="glass tilt-3d flex items-start gap-4 rounded-2xl p-4">
                <span className="neo-inset grid size-11 shrink-0 place-items-center rounded-xl">
                  <StageSealGlyph status={status} className={`size-6 ${tone}`} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono-tech text-[11px] font-semibold tracking-wider text-slate-400">{code}</p>
                  <h3 className="text-sm font-semibold">{itemTitle}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto w-full max-w-md animate-fade-up">
          <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </GlassPanel>
          <p className="mt-6 text-center text-sm text-slate-300">{footer}</p>
        </div>
      </main>
    </div>
  );
}
