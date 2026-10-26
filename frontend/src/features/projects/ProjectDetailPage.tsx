import { type FormEvent, useEffect, useState } from "react";
import {
  FiActivity,
  FiArrowLeft,
  FiArrowRight,
  FiBarChart2,
  FiBookOpen,
  FiCheck,
  FiChevronDown,
  FiCompass,
  FiEdit2,
  FiEdit3,
  FiFileText,
  FiMessageCircle,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FacetTriadGlyph, StageSealGlyph } from "../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { Spinner } from "../../components/ui/Spinner";
import { ApiError } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { forgeSceneStore } from "../../lib/forgeSceneStore";
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { StatusBadge } from "./components/badges";
import { EmptyState } from "./components/EmptyState";
import { REQUIRED_ATTRIBUTES, TITLE_MAX_LENGTH } from "./constants";
import type { ProjectOutletContext } from "./outlet";
import { useDeleteProject, useProject, useUpdateProject } from "./queries";
import type { ProjectDetail, ProjectStatus } from "./types";

function TitleEditor({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject(project.id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await updateProject.mutateAsync({ title: title.trim() });
      setEditing(false);
    } catch {
      // Se muestra updateProject.error.
    }
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-start gap-2">
        <h1 className="font-display min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">
          {project.title}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Editar nombre del proyecto"
          onClick={() => {
            setTitle(project.title);
            setEditing(true);
          }}
        >
          <FiEdit2 aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor="project-title" className="sr-only">
          Nombre del proyecto
        </label>
        <input
          id="project-title"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          className="neo-inset h-11 min-w-0 flex-1 rounded-xl px-4 text-lg font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
          autoFocus
        />
        <Button type="submit" size="icon" aria-label="Guardar nombre" loading={updateProject.isPending} disabled={!title.trim()}>
          {!updateProject.isPending && <FiCheck aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Cancelar edición del nombre" onClick={() => setEditing(false)}>
          <FiX aria-hidden="true" />
        </Button>
      </div>
      {updateProject.isError && <Alert>{errorMessageFrom(updateProject.error)}</Alert>}
    </form>
  );
}

function DeleteProjectButton({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const deleteProject = useDeleteProject(project.id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="danger" size="sm" icon={<FiTrash2 aria-hidden="true" />} onClick={() => setOpen(true)}>
        Eliminar
      </Button>
      <ConfirmDialog
        open={open}
        title="¿Eliminar este proyecto?"
        confirmLabel="Eliminar definitivamente"
        loading={deleteProject.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          deleteProject.mutate(undefined, { onSuccess: () => navigate("/proyectos", { replace: true }) })
        }
      >
        <p>
        Se borrará <strong className="text-slate-100">{project.title}</strong> con sus resultados, fuentes e informes.
        Esta acción no se puede deshacer.
        </p>
        {deleteProject.isError && (
          <div className="mt-3">
            <Alert>{errorMessageFrom(deleteProject.error)}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

const NEXT_STAGE_GUIDE: Record<
  ProjectStatus,
  { title: string; detail: string; to: string; cta: string; heat: number }
> = {
  draft: {
    title: "Paso 1 · Completa lo básico",
    detail: "Añade qué problema quieres resolver, cómo lo harías y quién lo necesita.",
    to: "",
    cta: "Completar idea",
    heat: 0.3,
  },
  structured: {
    title: "Paso 2 · Busca información",
    detail: "Revisaremos fuentes para conocer el mercado y las alternativas que ya existen.",
    to: "/investigacion",
    cta: "Empezar investigación",
    heat: 0.55,
  },
  researching: {
    title: "Paso 3 · Revisa los resultados",
    detail: "Comprueba las fuentes y lo que encontramos antes de sacar conclusiones.",
    to: "/hallazgos",
    cta: "Ver resultados",
    heat: 0.78,
  },
  analyzed: {
    title: "Paso 5 · Lee el veredicto",
    detail: "Consulta la recomendación, sus motivos, la estimación de inversión y los datos que aún faltan.",
    to: "/reportes",
    cta: "Ver veredicto final",
    heat: 0.96,
  },
};

const PRIMARY_TABS = [
  { path: "", label: "Idea", step: "01", hint: "Cuéntanos qué quieres crear", icon: FiEdit3 },
  { path: "/investigacion", label: "Investigar", step: "02", hint: "Busca información", icon: FiCompass },
  { path: "/hallazgos", label: "Resultados", step: "03", hint: "Revisa lo que encontramos", icon: FiFileText },
  { path: "/analisis", label: "Analizar", step: "04", hint: "Revisa riesgos y oportunidades", icon: FiActivity },
  { path: "/reportes", label: "Veredicto", step: "05", hint: "Recomendación y siguientes pasos", icon: FiFileText },
];

const TOOL_TABS = [
  { path: "/competidores", label: "Otras opciones", icon: FiUsers },
  { path: "/asistente", label: "Preguntar al asistente", icon: FiMessageCircle },
  { path: "/fuentes", label: "Ver fuentes", icon: FiBookOpen },
  { path: "/visualizaciones", label: "Gráficos", icon: FiBarChart2 },
];

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const { pathname } = useLocation();
  const project = useProject(projectId);
  useDocumentTitle(project.data?.title ?? "Proyecto");

  const status = project.data?.status;
  const missingCount = project.data?.structure.missing.length ?? REQUIRED_ATTRIBUTES.length;
  const confirmedRequired = REQUIRED_ATTRIBUTES.length - missingCount;

  useEffect(() => {
    if (!status) return;
    forgeSceneStore.set({
      mode: "workspace",
      heat: NEXT_STAGE_GUIDE[status].heat,
      litFacets: confirmedRequired,
    });
  }, [status, confirmedRequired]);

  if (project.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando proyecto…
      </div>
    );
  }

  if (project.isError) {
    const notFound =
      project.error instanceof ApiError && (project.error.status === 404 || project.error.status === 422);
    return notFound ? (
      <EmptyState
        icon={FiSearch}
        title="Proyecto no encontrado"
        description="No existe o no tienes acceso a él."
        action={<LinkButton to="/proyectos" variant="secondary">Ver mis proyectos</LinkButton>}
      />
    ) : (
      <GlassPanel className="flex flex-col items-start gap-4 p-6">
        <Alert>{errorMessageFrom(project.error)}</Alert>
        <Button variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={() => project.refetch()}>
          Reintentar
        </Button>
      </GlassPanel>
    );
  }

  const data = project.data;
  const guide = NEXT_STAGE_GUIDE[data.status];

  return (
    <div className="flex flex-col gap-5">
      {/* Resumen del proyecto y su siguiente paso recomendado */}
      <GlassPanel className="stage-3d flex flex-col gap-5 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LinkButton to="/proyectos" variant="ghost" size="sm" icon={<FiArrowLeft aria-hidden="true" />}>
            Proyectos
          </LinkButton>
          <DeleteProjectButton project={data} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="neo-raised hidden size-12 shrink-0 place-items-center rounded-2xl text-accent-cyan sm:grid">
              <StageSealGlyph status={data.status} className="size-7" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <TitleEditor key={data.title} project={data} />
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                <StatusBadge status={data.status} />
                <span className="neo-inset inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium text-slate-200">
                  <FacetTriadGlyph lit={confirmedRequired} />
                  <span>
                  Datos básicos: {confirmedRequired}/{REQUIRED_ATTRIBUTES.length}
                  </span>
                </span>
                <span>
                  Actualizado el <time dateTime={data.updated_at}>{formatDateTime(data.updated_at)}</time>
                </span>
              </div>
            </div>
          </div>

          <div className="neo-raised flex flex-col justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="font-mono-tech text-xs font-semibold tracking-wider text-accent-cyan uppercase">
                {guide.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{guide.detail}</p>
            </div>
            <LinkButton
              to={`/proyectos/${data.id}${guide.to}`}
              variant="secondary"
              size="sm"
              className="shrink-0"
            >
              {guide.cta} <FiArrowRight aria-hidden="true" />
            </LinkButton>
          </div>
        </div>
      </GlassPanel>

      {/* Cadena de Forja (rail de 8 etapas) + lienzo de trabajo */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <ProjectTabs projectId={data.id} />
        <div key={pathname} className="animate-liquid-screen min-w-0">
          <Outlet context={{ project: data } satisfies ProjectOutletContext} />
        </div>
      </div>
    </div>
  );
}

function ProjectTabs({ projectId }: { projectId: string }) {
  const { pathname } = useLocation();
  const toolsOpen = TOOL_TABS.some(({ path }) => pathname.endsWith(path));

  return (
    <nav
      aria-label="Secciones del proyecto"
      className="glass relative flex min-w-0 flex-col gap-2 rounded-2xl p-2.5 xl:sticky xl:top-24 xl:self-start"
    >
      <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
        Pasos principales
      </p>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-1">
        {PRIMARY_TABS.map(({ path, label, step, hint, icon: Icon }) => (
          <li key={label}>
            <NavLink
              to={`/proyectos/${projectId}${path}`}
              end
              className={({ isActive }) =>
                cn(
                  "jelly flex min-h-12 items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition sm:gap-3 sm:px-3 xl:min-h-11",
                  isActive
                    ? "neo-raised font-semibold text-primary ring-1 ring-primary/20"
                    : "text-slate-500 hover:bg-primary/5 hover:text-slate-100",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg text-[10px] font-semibold",
                      isActive ? "bg-primary/10 text-primary" : "bg-muted text-slate-400",
                    )}
                  >
                    {step}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate">{label}</span>
                    <span className="hidden truncate text-[11px] font-normal text-slate-400 xl:block">{hint}</span>
                  </span>
                  <Icon aria-hidden="true" className="ml-auto hidden size-4 shrink-0 text-primary xl:block" />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <details open={toolsOpen} className="border-t border-border/70 pt-2">
        <summary className="jelly flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-400 hover:bg-primary/5 hover:text-primary [&::-webkit-details-marker]:hidden">
          <span>Más herramientas</span>
          <FiChevronDown aria-hidden="true" className="size-4 transition-transform open:rotate-180" />
        </summary>
        <ul className="mt-1 flex flex-col gap-1">
          {TOOL_TABS.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={`/proyectos/${projectId}${path}`}
                className={({ isActive }) =>
                  cn(
                    "jelly flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition",
                    isActive
                      ? "bg-primary/8 font-medium text-primary"
                      : "text-slate-400 hover:bg-primary/5 hover:text-slate-100",
                  )
                }
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
