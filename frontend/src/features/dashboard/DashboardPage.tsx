/**
 * ARCHIVO: frontend/src/features/dashboard/DashboardPage.tsx
 *
 * ¿Qué es?
 * El panel principal ("Panel"), la pantalla de inicio después de entrar. Es la dirección "/".
 *
 * ¿Para qué sirve?
 * Para responder en un vistazo: ¿cómo van mis ideas? ¿dónde sigo? Y para llevar a la persona al siguiente paso.
 *
 * Hay dos versiones de la pantalla, según el número de proyectos:
 * 1. Primer proyecto (la cuenta no tiene ninguno): se muestra FirstProjectGuide, una guía con los 5 pasos
 *    del método y un solo botón grande "Crear mi primer proyecto".
 * 2. Con proyectos: se muestran cuatro tarjetas de resumen (una por etapa), la tarjeta "Continuar donde lo
 *    dejaste" con el proyecto más reciente, el método resumido y la lista de proyectos recientes.
 *
 * Partes de la pantalla (de arriba abajo):
 * - Banner de bienvenida con saludo personalizado (usa el primer nombre de la persona) y botón de nueva idea.
 * - Mensaje de error si no se pudo cargar el resumen.
 * - Tarjetas de resumen por etapa. Cada una es un enlace que filtra la lista de proyectos.
 * - Panel "Tu siguiente paso": el proyecto más reciente, su avance (barra de progreso) y un botón para continuar.
 * - Proyectos recientes: hasta 6 tarjetas.
 *
 * Datos que usa:
 * - overview (useProjectsOverview): cuántos proyectos hay en total y en cada etapa.
 * - recent (useProjectList): los 6 proyectos más recientes.
 * - user (useAuth): para el saludo con el nombre.
 *
 * ¿Quién lo usa?
 * app/router.tsx (ruta índice "/", dentro de AppShell).
 */
import { useEffect } from "react";
import { FiActivity, FiArrowRight, FiCheckCircle, FiCompass, FiEdit3, FiPlus } from "react-icons/fi";
import { Link } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { HeroIllustration } from "../../components/ui/ForgeGlyphs";
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

/** Cuántos proyectos recientes se piden para la lista del panel. */
const RECENT_COUNT = 6;

/** Icono de cada etapa, en el mismo orden que las tarjetas de resumen. */
const STATUS_ICON = {
  draft: FiEdit3,
  structured: FiCheckCircle,
  researching: FiCompass,
  analyzed: FiActivity,
};

/**
 * Lo que se muestra para cada etapa del proyecto:
 * - pct: el porcentaje de avance de validación (barra de progreso).
 * - action: la frase que explica qué toca hacer en esa etapa.
 * - route: a qué pestaña del proyecto llevar el botón "Continuar". Vacía = la pestaña principal (la idea).
 */
const STATUS_ACTION: Record<ProjectStatus, { pct: number; action: string; route: string }> = {
  draft: { pct: 25, action: "Completa la información base de la idea.", route: "" },
  structured: { pct: 50, action: "Inicia la investigación para encontrar evidencia.", route: "/investigacion" },
  researching: { pct: 75, action: "Revisa los resultados y las opciones que encontramos.", route: "/hallazgos" },
  analyzed: { pct: 100, action: "Consulta el veredicto y los siguientes pasos sugeridos.", route: "/reportes" },
};

/**
 * Los cinco pasos del método IdeaForge, con su número, título, descripción e icono.
 * Se usan en la guía del primer proyecto y en el resumen del método del panel.
 */
const VALIDATION_STEPS = [
  { number: "01", title: "Cuéntanos tu idea", text: "Qué problema resuelve y para quién.", icon: FiEdit3 },
  { number: "02", title: "Completa lo básico", text: "Te diremos qué información falta.", icon: FiCheckCircle },
  { number: "03", title: "Busca información", text: "Revisamos fuentes y otras opciones.", icon: FiCompass },
  { number: "04", title: "Revisa qué significa", text: "Explora oportunidades, riesgos y dudas.", icon: FiActivity },
  { number: "05", title: "Lee el veredicto", text: "Consulta la recomendación y los próximos pasos.", icon: FiCheckCircle },
];

/**
 * Guía para la primera vez: cuando la cuenta no tiene proyectos.
 *
 * Muestra los cinco pasos del método y un recordatorio de que la persona tiene la última palabra
 * (la IA propone, la persona decide). No tiene datos propios ni estado: solo presenta texto.
 */
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
        {/* Lista ordenada de los pasos: en pantallas medianas, dos columnas. */}
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

      {/* Recordatorio de que la decisión final es de la persona, no de la IA. */}
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

/**
 * Panel principal. No recibe props: obtiene sus datos de la API y del contexto de autenticación.
 */
export function DashboardPage() {
  // Título de la pestaña del navegador.
  useDocumentTitle("Panel");
  // Datos de la persona conectada (para el saludo).
  const { user } = useAuth();
  // Primer nombre: "María López" -> "María". Si no hay usuario cargado, queda vacío y no se saluda.
  const firstName = user?.full_name.trim().split(" ")[0] ?? "";
  // Resumen por etapas (total y conteo por etapa).
  const overview = useProjectsOverview();
  // Los proyectos más recientes (solo los primeros 6, sin paginar).
  const recent = useProjectList({ limit: RECENT_COUNT, offset: 0 });
  // El proyecto más reciente, o undefined si no hay ninguno. Es el primero de la lista (ordenada por actividad).
  const latestProject = recent.data?.items[0];
  // Es "primer proyecto" cuando el resumen cargó bien y el total es cero.
  const isFirstProject = overview.isSuccess && overview.data.total === 0;

  // Actualiza la escena 3D decorativa según el avance general. Entre más proyectos analizados, más "calor".
  useEffect(() => {
    const analyzed = overview.data?.by_status.analyzed ?? 0;
    const total = overview.data?.total ?? 0;
    forgeSceneStore.set({
      mode: "dashboard",
      // Con proyectos: entre 0.35 y 0.95 según la proporción de analizados. Sin proyectos: 0.3.
      heat: total ? Math.min(0.95, 0.35 + (analyzed / total) * 0.6) : 0.3,
      // Si el proyecto más reciente es borrador, se ilumina 1 faceta; si ya avanzó, 3.
      litFacets: latestProject ? (latestProject.status === "draft" ? 1 : 3) : 1,
    });
  }, [overview.data, latestProject]);

  // Botón de crear proyecto. Cambia de texto y de estilo según si es el primer proyecto o no.
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
      {/* Banner de bienvenida con ilustración vectorial animada y acciones claras. */}
      <section aria-labelledby="dashboard-title" className="dashboard-hero relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
        <div aria-hidden="true" className="dashboard-hero__orb dashboard-hero__orb--one" />
        <div aria-hidden="true" className="dashboard-hero__orb dashboard-hero__orb--two" />
        <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[1.25fr_0.9fr]">
          <div className="flex flex-col gap-5">
            <div>
              <p className="dashboard-eyebrow">
                <FiActivity aria-hidden="true" />
                INVESTIGACIÓN DE NEGOCIO
              </p>
              <h1 id="dashboard-title" className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl xl:text-[2.65rem]">
                {isFirstProject ? (
                  <>Empieza con tu idea<span className="dashboard-hero__highlight">.</span></>
                ) : (
                  <>
                    {firstName ? `Hola, ${firstName}. ` : ""}
                    <span className="dashboard-hero__highlight">Decide con evidencia.</span>
                  </>
                )}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
                {isFirstProject
                  ? "No necesitas experiencia ni una idea perfecta. Cuéntanos qué te gustaría hacer y te ayudaremos a explorarla."
                  : "Organiza tus ideas, encuentra señales del mercado y convierte la investigación en próximos pasos claros."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              {newProject}
              {!isFirstProject && (
                <LinkButton to="/proyectos" variant="secondary" className="dashboard-hero__secondary">
                  Ver proyectos <FiArrowRight aria-hidden="true" />
                </LinkButton>
              )}
            </div>
          </div>
          <div className="hidden lg:block">
            <HeroIllustration className="mx-auto h-48 w-full max-w-sm drop-shadow-xl" />
          </div>
        </div>
        <div aria-hidden="true" className="dashboard-hero__rule" />
      </section>

      {overview.isError && <Alert>{errorMessageFrom(overview.error)}</Alert>}
      {isFirstProject ? (
        <FirstProjectGuide />
      ) : (
        <>
      {/* Tarjetas de resumen: una por etapa. Cada tarjeta es un enlace que abre la lista filtrada por esa etapa. */}
      <section aria-label="Resumen de proyectos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PROJECT_STATUSES.map((status, index) => {
          const Icon = STATUS_ICON[status];
          // Cantidad de proyectos en esa etapa. Si todavía no llega el dato, se muestra una raya.
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
                {/* Frase fija según la posición de la etapa: primera "por definir", cuarta "listos para decidir". */}
                <p className="mt-1 text-xs text-slate-400">
                  {index === 0 ? "Por definir" : index === 3 ? "Listos para decidir" : "En el proceso"}
                </p>
              </div>
              {/* El color del icono cambia según la etapa; "cn" solo añade la clase cuando la condición es verdadera. */}
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

      {/* "Tu siguiente paso": el proyecto más reciente con su avance. Tiene cuatro estados posibles. */}
      <section aria-label="Tu siguiente paso" className="grid gap-4">
        <GlassPanel className="flex min-h-64 flex-col justify-between gap-6 rounded-3xl p-5 sm:p-6">
          {recent.isPending ? (
            // Cargando: un indicador animado. role="status" anuncia el cambio a lectores de pantalla.
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
                  {/* line-clamp-2 corta el título a dos líneas si es muy largo. */}
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
                {/* Barra de progreso accesible: el lector de pantalla lee el valor entre 0 y 100. */}
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={STATUS_ACTION[latestProject.status].pct}
                  aria-label={`Avance de ${latestProject.title}`}
                >
                  {/* El ancho se pone en línea (style) porque cambia según el proyecto; "transition" lo anima. */}
                  <div
                    className="progress-liquid h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${STATUS_ACTION[latestProject.status].pct}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>Actualizado {formatRelative(latestProject.updated_at)}</span>
                  {/* Lleva a la pestaña que corresponde a la etapa actual (investigación, hallazgos o reportes). */}
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
            // No hay proyectos (la guía del primer proyecto ya cubre este caso, esto es respaldo).
            <EmptyState
              icon={FiPlus}
              title="Empieza con una idea"
              description="La guía te ayudará a estructurarla y buscar evidencia útil."
              action={newProject}
            />
          )}
        </GlassPanel>

        {/* Resumen del método en cuatro (dos columnas) tarjetas pequeñas. */}
      </section>

      {/* Proyectos recientes: tarjetas de hasta seis proyectos. */}
      <section aria-labelledby="recent-projects-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-eyebrow">PORTAFOLIO</p>
            <h2 id="recent-projects-title" className="mt-1 text-xl font-semibold tracking-tight">
              Proyectos recientes
            </h2>
          </div>
          {/* "Ver todos" solo aparece si hay al menos un proyecto (!! convierte el número en verdadero o falso). */}
          {!!recent.data?.total && (
            <LinkButton to="/proyectos" variant="ghost" size="sm">
              Ver todos <FiArrowRight aria-hidden="true" />
            </LinkButton>
          )}
        </div>

        {recent.isPending ? (
          // Cargando: tres tarjetas de esqueleto.
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
