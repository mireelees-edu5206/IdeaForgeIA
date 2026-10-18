import { useEffect } from "react";
import { FiArrowRight, FiFolder, FiPlus, FiShield } from "react-icons/fi";
import { Link } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { CrucibleGlyph, FilamentBridgeGlyph, StageSealGlyph } from "../../components/ui/ForgeGlyphs";
import { LinkButton } from "../../components/ui/LinkButton";
import { cn } from "../../lib/cn";
import { forgeSceneStore } from "../../lib/forgeSceneStore";
import { formatRelative } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../projects/components/badges";
import { EmptyState } from "../projects/components/EmptyState";
import { ProjectCard, ProjectCardSkeleton } from "../projects/components/ProjectCard";
import { PROJECT_STATUSES, STATUS_META } from "../projects/constants";
import { useProjectList, useProjectsOverview } from "../projects/queries";
import type { ProjectStatus } from "../projects/types";

const RECENT_COUNT = 6;

const FORGE_CONDUIT: Array<{
  step: string;
  title: string;
  detail: string;
  status: ProjectStatus;
}> = [
  {
    step: "01",
    title: "Mineral en bruto",
    detail: "Captura problema, solución y segmento sin autocompletar certezas.",
    status: "draft",
  },
  {
    step: "02",
    title: "Temple de estructura",
    detail: "Bloquea la base mínima y formula consultas verificables.",
    status: "structured",
  },
  {
    step: "03",
    title: "Escaneo y contraste",
    detail: "Extrae hallazgos con citas literales y detecta rivales.",
    status: "researching",
  },
  {
    step: "04",
    title: "Cristal tallado",
    detail: "Separa oportunidades, riesgos, hipótesis e incertidumbre.",
    status: "analyzed",
  },
];

const STAGE_PROGRESS: Record<ProjectStatus, { pct: number; action: string; material: string }> = {
  draft: { pct: 25, action: "Confirmar las 3 facetas obligatorias", material: "Piedra translúcida · sin templar" },
  structured: { pct: 50, action: "Iniciar investigación con fuentes", material: "Aleación de bronce · estructurada" },
  researching: { pct: 75, action: "Revisar hallazgos y lanzar análisis", material: "Cobre incandescente · en contraste" },
  analyzed: { pct: 100, action: "Explorar cuadrantes e hipótesis", material: "Cristal tallado · trazable" },
};

const ORBIT_COORDS: Record<ProjectStatus, { angle: string; radius: string }> = {
  draft: { angle: "29%", radius: "22%" },
  structured: { angle: "71%", radius: "22%" },
  researching: { angle: "29%", radius: "76%" },
  analyzed: { angle: "71%", radius: "76%" },
};

export function DashboardPage() {
  useDocumentTitle("Panel");
  const { user } = useAuth();
  const firstName = user?.full_name.split(" ")[0] ?? "";
  const overview = useProjectsOverview();
  const recent = useProjectList({ limit: RECENT_COUNT, offset: 0 });
  const latestProject = recent.data?.items[0];
  const restProjects = recent.data?.items.slice(1) ?? [];

  useEffect(() => {
    const analyzed = overview.data?.by_status.analyzed ?? 0;
    const total = overview.data?.total ?? 0;
    forgeSceneStore.set({
      mode: "dashboard",
      heat: total ? Math.min(0.95, 0.35 + (analyzed / total) * 0.6) : 0.3,
      litFacets: latestProject ? (latestProject.status === "draft" ? 1 : 3) : 1,
    });
  }, [overview.data, latestProject]);

  const newProject = (
    <LinkButton to="/proyectos/nuevo" icon={<FiPlus aria-hidden="true" />}>
      Nuevo proyecto
    </LinkButton>
  );

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      {/* Cabecera hero + Sistema Orbital del Portafolio */}
      <section aria-labelledby="resumen" className="grid gap-5 xl:grid-cols-[1.28fr_1fr]">
        <h2 id="resumen" className="sr-only">
          Resumen
        </h2>

        <div className="stage-3d flex flex-col justify-between gap-7 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="neo-inset font-mono-tech inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider text-accent-cyan uppercase">
                <CrucibleGlyph className="size-3.5" /> Crisol de validación empírica
              </span>
              <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Hola, <span className="text-gradient">{firstName}</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Aquí cada idea atraviesa calor y evidencia: de la intuición inicial a hallazgos citados, rivales
                clasificados e incertidumbre explícita.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {newProject}
              <LinkButton to="/proyectos" variant="secondary">
                Portafolio
              </LinkButton>
            </div>
          </div>

          {/* Camino continuo (no 4 cajas aisladas) */}
          <div aria-label="Conducto de forja" className="relative">
            <div
              aria-hidden="true"
              className="filament-line pointer-events-none absolute top-5 right-6 left-6 hidden h-0.5 opacity-55 lg:block"
            />
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FORGE_CONDUIT.map(({ step, title, detail, status }) => (
                <li key={step} className="glass tilt-3d relative flex flex-col gap-2 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="neo-raised font-mono-tech inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold text-accent-cyan">
                      {step}
                    </span>
                    <StageSealGlyph status={status} className="size-5 text-accent-violet" />
                  </div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-relaxed text-slate-400">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sistema Orbital del Portafolio */}
        <div className="glass flex flex-col justify-between gap-4 rounded-3xl p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono-tech text-xs font-semibold tracking-wider text-accent-cyan uppercase">
                Órbita material del portafolio
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Cada cuerpo refleja el estado de forja de tus ideas
              </p>
            </div>
            <FilamentBridgeGlyph className="h-4 w-14 text-accent-violet" />
          </div>

          {overview.isError ? (
            <Alert>{errorMessageFrom(overview.error)}</Alert>
          ) : (
            <div className="neo-inset relative min-h-64 overflow-hidden rounded-3xl p-4">
              {/* Anillos orbitales SVG */}
              <svg
                viewBox="0 0 320 220"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-45"
              >
                <ellipse
                  cx="160"
                  cy="110"
                  rx="132"
                  ry="82"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-slate-400"
                />
                <ellipse
                  cx="160"
                  cy="110"
                  rx="82"
                  ry="50"
                  fill="none"
                  stroke="currentColor"
                  className="text-accent-cyan"
                />
              </svg>

              {/* Núcleo central con el total */}
              <div className="neo-raised absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl px-4 py-2.5 text-center ring-1 ring-accent-cyan/35">
                <CrucibleGlyph className="size-5 text-accent-cyan" />
                <p className="font-display mt-0.5 text-2xl leading-none font-bold tabular-nums">
                  {overview.data?.total ?? "—"}
                </p>
                <p className="font-mono-tech text-[10px] tracking-wider text-slate-400 uppercase">Ideas</p>
              </div>

              {/* 4 cuerpos orbitales por estado */}
              {PROJECT_STATUSES.map((status) => {
                const count = overview.data?.by_status[status];
                const pos = ORBIT_COORDS[status];
                return (
                  <Link
                    key={status}
                    to={`/proyectos?estado=${status}`}
                    style={{ left: pos.angle, top: pos.radius }}
                    className="neo-raised tilt-3d jelly absolute flex max-w-[44%] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-left sm:max-w-none sm:gap-2.5 sm:px-3 sm:py-2"
                  >
                    <StageSealGlyph status={status} className="size-5 shrink-0 text-accent-cyan sm:size-6" />
                    <div className="min-w-0">
                      <p className="font-display text-sm leading-none font-bold tabular-nums sm:text-base">
                        {count ?? "·"}
                      </p>
                      <p className="truncate text-[10px] font-medium text-slate-300 sm:text-[11px] sm:whitespace-nowrap">
                        {STATUS_META[status].label}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="neo-inset flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs text-slate-300">
            <FiShield aria-hidden="true" className="shrink-0 text-accent-cyan" />
            <span>No encontrar competencia no equivale a que no exista: la incertidumbre se declara.</span>
          </div>
        </div>
      </section>

      {/* Actividad reciente */}
      <section aria-labelledby="recientes" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="recientes" className="text-lg font-semibold">
              Actividad reciente
            </h2>
            <p className="text-xs text-slate-400">Pieza activa en el yunque y resto de proyectos</p>
          </div>
          {!!recent.data?.total && (
            <LinkButton to="/proyectos" variant="ghost" size="sm">
              Ver todos <FiArrowRight aria-hidden="true" />
            </LinkButton>
          )}
        </div>

        {recent.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : recent.isError ? (
          <Alert>{errorMessageFrom(recent.error)}</Alert>
        ) : recent.data.items.length === 0 ? (
          <EmptyState
            icon={FiFolder}
            title="Todavía no tienes proyectos"
            description="Crea tu primer proyecto: describe tu idea con tus palabras y después la estructuraremos juntos."
            action={newProject}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.18fr_1fr]">
            {latestProject && (
              <Link
                to={`/proyectos/${latestProject.id}`}
                className={cn(
                  "stage-3d tilt-3d jelly group flex flex-col justify-between gap-6 rounded-3xl p-6",
                  restProjects.length === 0 && "lg:col-span-2",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="neo-inset font-mono-tech inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-accent-cyan">
                    <StageSealGlyph status={latestProject.status} className="size-4 shrink-0" />
                    <span className="truncate">{STAGE_PROGRESS[latestProject.status].material}</span>
                  </span>
                  <StatusBadge status={latestProject.status} />
                </div>

                <div>
                  <h3 className="font-display text-2xl font-bold tracking-tight group-hover:text-accent-cyan">
                    {latestProject.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-300">
                    Siguiente golpe de forja:{" "}
                    <strong className="font-semibold text-slate-100">
                      {STAGE_PROGRESS[latestProject.status].action}
                    </strong>
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="font-mono-tech flex items-center justify-between text-xs text-slate-400">
                    <span>TEMPLE DEL PROYECTO</span>
                    <span className="font-semibold tabular-nums">
                      {STAGE_PROGRESS[latestProject.status].pct} %
                    </span>
                  </div>
                  <div className="neo-inset h-2.5 overflow-hidden rounded-full">
                    <div
                      className="filament-line h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${STAGE_PROGRESS[latestProject.status].pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Actualizado {formatRelative(latestProject.updated_at)}</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-accent-cyan">
                    Entrar al taller <FiArrowRight aria-hidden="true" />
                  </span>
                </div>
              </Link>
            )}

            {restProjects.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {restProjects.slice(0, 3).map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
