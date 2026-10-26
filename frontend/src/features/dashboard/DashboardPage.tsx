import { useEffect } from "react";
import { FiActivity, FiArrowRight, FiCheckCircle, FiCompass, FiEdit3, FiPlus } from "react-icons/fi";
import { Link } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { GlassPanel } from "../../components/ui/GlassPanel";
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

const STATUS_ICON = {
  draft: FiEdit3,
  structured: FiCheckCircle,
  researching: FiCompass,
  analyzed: FiActivity,
};

const STATUS_ACTION: Record<ProjectStatus, { pct: number; action: string; route: string }> = {
  draft: { pct: 25, action: "Completa la información base de la idea.", route: "" },
  structured: { pct: 50, action: "Inicia la investigación para encontrar evidencia.", route: "/investigacion" },
  researching: { pct: 75, action: "Revisa los resultados y las opciones que encontramos.", route: "/hallazgos" },
  analyzed: { pct: 100, action: "Consulta el veredicto y los siguientes pasos sugeridos.", route: "/reportes" },
};

const VALIDATION_STEPS = [
  { number: "01", title: "Cuéntanos tu idea", text: "Qué problema resuelve y para quién.", icon: FiEdit3 },
  { number: "02", title: "Completa lo básico", text: "Te diremos qué información falta.", icon: FiCheckCircle },
  { number: "03", title: "Busca información", text: "Revisamos fuentes y otras opciones.", icon: FiCompass },
  { number: "04", title: "Revisa qué significa", text: "Explora oportunidades, riesgos y dudas.", icon: FiActivity },
  { number: "05", title: "Lee el veredicto", text: "Consulta la recomendación y los próximos pasos.", icon: FiCheckCircle },
];

function FirstProjectGuide() {
  return (
    <section aria-labelledby="first-project-guide-title" className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.7fr)]">
      <GlassPanel className="rounded-3xl p-5 sm:p-7">
        <p className="section-eyebrow">EMPIEZA POR AQUÍ</p>
        <h2 id="first-project-guide-title" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          No necesitas tenerlo todo resuelto.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Te guiaremos paso a paso. Puedes cambiar la información de tu proyecto cuando quieras.
        </p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {VALIDATION_STEPS.map(({ number, title, text, icon: Icon }) => (
            <li key={number} className="method-step flex items-start gap-3 rounded-xl p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </GlassPanel>

      <aside className="surface-panel flex flex-col justify-center rounded-3xl p-5 sm:p-6">
        <span className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-200">
          <FiCheckCircle aria-hidden="true" className="size-5" />
        </span>
        <h3 className="mt-4 text-base font-semibold">Tú tienes la última palabra</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          La IA propone y organiza información. Tú revisas las fuentes y decides qué conclusiones aceptar.
        </p>
      </aside>
    </section>
  );
}

export function DashboardPage() {
  useDocumentTitle("Panel");
  const { user } = useAuth();
  const firstName = user?.full_name.trim().split(" ")[0] ?? "";
  const overview = useProjectsOverview();
  const recent = useProjectList({ limit: RECENT_COUNT, offset: 0 });
  const latestProject = recent.data?.items[0];
  const isFirstProject = overview.isSuccess && overview.data.total === 0;

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
    <LinkButton
      to="/proyectos/nuevo"
      icon={<FiPlus aria-hidden="true" />}
      className={isFirstProject ? "dashboard-hero__primary" : undefined}
    >
      {isFirstProject ? "Crear mi primer proyecto" : "Nueva idea"}
    </LinkButton>
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="dashboard-title" className="dashboard-hero relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
        <div aria-hidden="true" className="dashboard-hero__orb dashboard-hero__orb--one" />
        <div aria-hidden="true" className="dashboard-hero__orb dashboard-hero__orb--two" />
        <div className="relative z-10 flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="dashboard-eyebrow">
              <FiActivity aria-hidden="true" />
              INVESTIGACIÓN DE NEGOCIO
            </p>
            <h1 id="dashboard-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl xl:text-[2.75rem]">
              {isFirstProject ? (
                <>Empieza con tu idea<span className="dashboard-hero__highlight">.</span></>
              ) : (
                <>
                  {firstName ? `Hola, ${firstName}. ` : ""}
                  <span className="dashboard-hero__highlight">Decide con evidencia.</span>
                </>
              )}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
              {isFirstProject
                ? "No necesitas experiencia ni una idea perfecta. Cuéntanos qué te gustaría hacer y te ayudaremos a explorarla."
                : "Organiza tus ideas, encuentra señales del mercado y convierte la investigación en próximos pasos claros."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {newProject}
            {!isFirstProject && (
              <LinkButton to="/proyectos" variant="secondary" className="dashboard-hero__secondary">
                Ver proyectos <FiArrowRight aria-hidden="true" />
              </LinkButton>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="dashboard-hero__rule" />
      </section>

      {overview.isError && <Alert>{errorMessageFrom(overview.error)}</Alert>}
      {isFirstProject ? (
        <FirstProjectGuide />
      ) : (
        <>
      <section aria-label="Resumen de proyectos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PROJECT_STATUSES.map((status, index) => {
          const Icon = STATUS_ICON[status];
          const value = overview.data?.by_status[status];
          return (
            <Link
              key={status}
              to={`/proyectos?estado=${status}`}
              className="summary-tile group flex items-center justify-between gap-4 rounded-2xl p-4"
            >
              <div>
                <p className="text-sm font-medium text-slate-400">{STATUS_META[status].label}</p>
                <p className="mt-1 font-mono-tech text-3xl font-semibold tracking-tight tabular-nums text-slate-100">
                  {value ?? "—"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {index === 0 ? "Por definir" : index === 3 ? "Listos para decidir" : "En el proceso"}
                </p>
              </div>
              <span
                className={cn(
                  "summary-tile__icon grid size-11 shrink-0 place-items-center rounded-xl",
                  status === "draft" && "summary-tile__icon--draft",
                  status === "structured" && "summary-tile__icon--structured",
                  status === "researching" && "summary-tile__icon--researching",
                  status === "analyzed" && "summary-tile__icon--analyzed",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
            </Link>
          );
        })}
      </section>

      <section aria-label="Tu siguiente paso" className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        <GlassPanel className="flex min-h-64 flex-col justify-between gap-6 rounded-3xl p-5 sm:p-6">
          {recent.isPending ? (
            <div role="status" className="flex items-center gap-2 text-sm text-slate-400">
              <span className="liquid-loader" aria-hidden="true" />
              Buscando dónde continuar…
            </div>
          ) : recent.isError ? (
            <Alert>{errorMessageFrom(recent.error)}</Alert>
          ) : latestProject ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-eyebrow">CONTINUAR DONDE LO DEJASTE</p>
                  <h2 className="mt-2 line-clamp-2 text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
                    {latestProject.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-400">{STATUS_ACTION[latestProject.status].action}</p>
                </div>
                <StatusBadge status={latestProject.status} />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-400">Avance de validación</span>
                  <span className="font-mono-tech font-semibold tabular-nums text-slate-200">
                    {STATUS_ACTION[latestProject.status].pct}%
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={STATUS_ACTION[latestProject.status].pct}
                  aria-label={`Avance de ${latestProject.title}`}
                >
                  <div
                    className="progress-liquid h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${STATUS_ACTION[latestProject.status].pct}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>Actualizado {formatRelative(latestProject.updated_at)}</span>
                  <LinkButton
                    to={`/proyectos/${latestProject.id}${STATUS_ACTION[latestProject.status].route}`}
                    variant="secondary"
                    size="sm"
                  >
                    Continuar <FiArrowRight aria-hidden="true" />
                  </LinkButton>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={FiPlus}
              title="Empieza con una idea"
              description="La guía te ayudará a estructurarla y buscar evidencia útil."
              action={newProject}
            />
          )}
        </GlassPanel>

        <aside className="surface-panel rounded-3xl p-5 sm:p-6">
          <div>
            <p className="section-eyebrow">MÉTODO IDEAFORGE</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">De la intuición a una decisión</h2>
          </div>
          <ol className="mt-5 grid grid-cols-2 gap-3">
            {VALIDATION_STEPS.map(({ number, title, text, icon: Icon }) => (
              <li key={number} className="method-step rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-[11px] font-semibold text-slate-400">{number}</span>
                  <Icon aria-hidden="true" className="size-4 text-primary" />
                </div>
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section aria-labelledby="recent-projects-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-eyebrow">PORTAFOLIO</p>
            <h2 id="recent-projects-title" className="mt-1 text-xl font-semibold tracking-tight">
              Proyectos recientes
            </h2>
          </div>
          {!!recent.data?.total && (
            <LinkButton to="/proyectos" variant="ghost" size="sm">
              Ver todos <FiArrowRight aria-hidden="true" />
            </LinkButton>
          )}
        </div>

        {recent.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <ProjectCardSkeleton key={index} />)}
          </div>
        ) : recent.isError ? (
          <Alert>{errorMessageFrom(recent.error)}</Alert>
        ) : recent.data.items.length === 0 ? (
          <EmptyState
            icon={FiActivity}
            title="Todavía no hay proyectos"
            description="Crea una idea para comenzar a explorarla con información verificable."
            action={newProject}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {recent.data.items.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
