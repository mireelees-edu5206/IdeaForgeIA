/**
 * ARCHIVO: frontend/src/features/projects/ProjectDetailPage.tsx
 *
 * ¿Qué es?
 * La página de un proyecto: el "marco" que se ve al abrir una idea (/proyectos/:projectId).
 * Muestra el encabezado del proyecto y el menú de pasos. La pantalla de cada paso (Idea, Investigar,
 * Resultados, etc.) se dibuja dentro de este marco, en el lugar de <Outlet />.
 *
 * ¿Qué se ve en pantalla?
 * 1. Un encabezado con:
 *    - Botón para volver a Proyectos y botón "Eliminar" (con confirmación).
 *    - Un sello con el símbolo de la etapa, el nombre del proyecto (editable), la etiqueta de etapa,
 *      el contador "Datos básicos: X/3" y la fecha de actualización.
 *    - Una tarjeta de "siguiente paso" con la recomendación para la etapa actual y su botón.
 * 2. Debajo, a la izquierda, el menú del proyecto (ProjectTabs):
 *    - "Pasos principales": Idea, Investigar, Resultados, Analizar y Veredicto.
 *    - "Más herramientas" (desplegable): Otras opciones, Asistente, Fuentes y Gráficos.
 * 3. A la derecha, el lienzo de trabajo con la pestaña elegida.
 *
 * Estados de la página:
 * - Cargando: un indicador con "Cargando proyecto…".
 * - No encontrado (404 o 422): aviso con botón para volver a Proyectos.
 * - Otro error: alerta con botón "Reintentar".
 *
 * Datos compartidos:
 * El proyecto completo se pasa a las pestañas hijas con <Outlet context={...} />. Las pestañas lo leen
 * con useProjectOutlet (ver outlet.ts), así no tienen que volver a pedirlo.
 *
 * ¿Quién lo usa?
 * features/projects/routes.tsx (ruta "/proyectos/:projectId" con sus pestañas hijas).
 */
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

/**
 * El nombre del proyecto, con un botón de lápiz para cambiarlo.
 *
 * Tiene dos modos:
 * - Normal: el título grande y un botón de lápiz.
 * - Edición: un campo de texto con botones de guardar (✓) y cancelar (✕).
 * El nombre no puede quedar vacío, y el botón de guardar se desactiva si lo está.
 */
function TitleEditor({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject(project.id);
  const [editing, setEditing] = useState(false);
  // Copia del nombre que se está escribiendo.
  const [title, setTitle] = useState(project.title);

  /** Guarda el nombre nuevo. Si la API responde bien, sale del modo edición. */
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

  // Modo normal: el título y el lápiz.
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
            // Al abrir la edición, el campo vuelve a tener el nombre guardado.
            setTitle(project.title);
            setEditing(true);
          }}
        >
          <FiEdit2 aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // Modo edición: el campo, con su etiqueta oculta a la vista pero leída por lectores de pantalla.
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
        {/* Botón de guardar. Mientras se guarda, muestra un indicador en lugar del check. */}
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

/**
 * Botón "Eliminar" con confirmación.
 *
 * Al pulsarlo, abre un cuadro de diálogo que pide confirmar. Solo si la persona confirma, borra el proyecto
 * y regresa a la lista. Borrar es irreversible, por eso siempre pasa por el diálogo.
 */
function DeleteProjectButton({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const deleteProject = useDeleteProject(project.id);
  // true cuando el cuadro de confirmación está abierto.
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
        // Al confirmar, borra y, si sale bien, lleva a la lista (replace para no volver a esta página).
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

/**
 * La recomendación para cada etapa del proyecto.
 *
 * - title y detail: el texto que explica qué toca hacer.
 * - to: la pestaña a la que lleva el botón (vacío = la pestaña Idea).
 * - cta: el texto del botón.
 * - heat: la intensidad de la escena 3D decorativa para esa etapa (más cerca de la meta, más brillo).
 */
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

/**
 * Las pestañas principales del proyecto, en el orden del método.
 * "path" es el sufijo de la dirección; "step" es el número que aparece en el cuadro del botón.
 */
const PRIMARY_TABS = [
  { path: "", label: "Idea", step: "01", hint: "Cuéntanos qué quieres crear", icon: FiEdit3 },
  { path: "/investigacion", label: "Investigar", step: "02", hint: "Busca información", icon: FiCompass },
  { path: "/hallazgos", label: "Resultados", step: "03", hint: "Revisa lo que encontramos", icon: FiFileText },
  { path: "/analisis", label: "Analizar", step: "04", hint: "Revisa riesgos y oportunidades", icon: FiActivity },
  { path: "/reportes", label: "Veredicto", step: "05", hint: "Recomendación y siguientes pasos", icon: FiFileText },
];

/** Las herramientas opcionales, que van dentro del desplegable "Más herramientas". */
const TOOL_TABS = [
  { path: "/competidores", label: "Otras opciones", icon: FiUsers },
  { path: "/asistente", label: "Preguntar al asistente", icon: FiMessageCircle },
  { path: "/fuentes", label: "Ver fuentes", icon: FiBookOpen },
  { path: "/visualizaciones", label: "Gráficos", icon: FiBarChart2 },
];

/**
 * El marco de la página de un proyecto. No recibe props: lee el id del proyecto de la dirección.
 */
export function ProjectDetailPage() {
  // "projectId" viene de la dirección /proyectos/:projectId. El valor por defecto "" evita errores si falta.
  const { projectId = "" } = useParams();
  // "pathname" es la dirección actual; se usa como clave para reiniciar la animación al cambiar de pestaña.
  const { pathname } = useLocation();
  const project = useProject(projectId);
  // El título de la pestaña del navegador es el nombre del proyecto, o "Proyecto" mientras carga.
  useDocumentTitle(project.data?.title ?? "Proyecto");

  // Etapa actual del proyecto, si ya cargó.
  const status = project.data?.status;
  // Cuántos atributos obligatorios faltan. Si no hay datos, se asume que faltan todos.
  const missingCount = project.data?.structure.missing.length ?? REQUIRED_ATTRIBUTES.length;
  // Cuántos atributos obligatorios ya están completos (3 menos los que faltan).
  const confirmedRequired = REQUIRED_ATTRIBUTES.length - missingCount;

  // Actualiza la escena 3D según la etapa y cuántos datos básicos están completos.
  useEffect(() => {
    if (!status) return;
    forgeSceneStore.set({
      mode: "workspace",
      heat: NEXT_STAGE_GUIDE[status].heat,
      litFacets: confirmedRequired,
    });
  }, [status, confirmedRequired]);

  // Estado 1: cargando. Muestra un indicador y no dibuja nada más.
  if (project.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando proyecto…
      </div>
    );
  }

  // Estado 2: error. Si es 404 o 422, el proyecto no existe o es de otra persona. Si no, un error genérico con reintento.
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

  // Estado 3: éxito. "data" ya tiene el proyecto completo.
  const data = project.data;
  // Recomendación para la etapa actual.
  const guide = NEXT_STAGE_GUIDE[data.status];

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado: botones superiores, nombre con sello, etapa, datos básicos y el siguiente paso. */}
      <GlassPanel className="stage-3d flex flex-col gap-5 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LinkButton to="/proyectos" variant="ghost" size="sm" icon={<FiArrowLeft aria-hidden="true" />}>
            Proyectos
          </LinkButton>
          <DeleteProjectButton project={data} />
        </div>

        {/* En pantallas grandes, el sello y el nombre a la izquierda; la recomendación a la derecha. */}
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div className="flex min-w-0 items-start gap-3.5">
            {/* El sello solo aparece en pantallas medianas en adelante (la clase "hidden" lo oculta en celular). */}
            <span className="neo-raised hidden size-12 shrink-0 place-items-center rounded-2xl text-accent-cyan sm:grid">
              <StageSealGlyph status={data.status} className="size-7" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              {/* "key" con el título: si el título cambia en el servidor, el editor se reinicia con el valor nuevo. */}
              <TitleEditor key={data.title} project={data} />
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                <StatusBadge status={data.status} />
                <span className="neo-inset inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium text-slate-200">
                  {/* El triángulo de facetas se ilumina según cuántos datos básicos ya están completos. */}
                  <FacetTriadGlyph lit={confirmedRequired} />
                  <span>
                  Datos básicos: {confirmedRequired}/{REQUIRED_ATTRIBUTES.length}
                  </span>
                </span>
                <span>
                  {/* "time" con dateTime lleva la fecha en formato técnico para el navegador y los lectores de pantalla. */}
                  Actualizado el <time dateTime={data.updated_at}>{formatDateTime(data.updated_at)}</time>
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta del siguiente paso recomendado para la etapa actual. */}
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

      {/* Menú del proyecto a la izquierda y la pestaña elegida a la derecha. */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <ProjectTabs projectId={data.id} />
        {/* La clave con la dirección hace que la animación de entrada se repita en cada cambio de pestaña. */}
        <div key={pathname} className="animate-liquid-screen min-w-0">
          {/* Entrega el proyecto a la pestaña hija. "satisfies" comprueba el tipo sin cambiarlo. */}
          <Outlet context={{ project: data } satisfies ProjectOutletContext} />
        </div>
      </div>
    </div>
  );
}

/**
 * El menú lateral de pestañas del proyecto.
 *
 * Muestra los pasos principales y un desplegable de herramientas. El desplegable se abre solo si la
 * dirección actual es una de sus herramientas, para que la pestaña activa siempre sea visible.
 */
function ProjectTabs({ projectId }: { projectId: string }) {
  const { pathname } = useLocation();
  // ¿La dirección actual termina en una de las herramientas? Si sí, el desplegable se abre por defecto.
  const toolsOpen = TOOL_TABS.some(({ path }) => pathname.endsWith(path));

  return (
    // "xl:sticky" mantiene el menú visible al hacer scroll en pantallas grandes.
    <nav
      aria-label="Secciones del proyecto"
      className="glass relative flex min-w-0 flex-col gap-2 rounded-2xl p-2.5 xl:sticky xl:top-24 xl:self-start"
    >
      <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
        Pasos principales
      </p>
      {/* En celular, dos o tres columnas; en pantallas grandes, una columna con la descripción de cada paso. */}
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-1">
        {PRIMARY_TABS.map(({ path, label, step, hint, icon: Icon }) => (
          <li key={label}>
            {/* "end" hace que el enlace de Idea (path vacío) solo quede activo en la dirección exacta del proyecto. */}
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
              {/* Cuando el enlace está activo, el número del paso cambia de color. */}
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
                    {/* La descripción corta solo se ve en pantallas grandes (xl). */}
                    <span className="hidden truncate text-[11px] font-normal text-slate-400 xl:block">{hint}</span>
                  </span>
                  <Icon aria-hidden="true" className="ml-auto hidden size-4 shrink-0 text-primary xl:block" />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Desplegable nativo (details/summary): se abre y cierra sin JavaScript. "open" controla si arranca abierto. */}
      <details open={toolsOpen} className="border-t border-border/70 pt-2">
        <summary className="jelly flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-400 hover:bg-primary/5 hover:text-primary [&::-webkit-details-marker]:hidden">
          <span>Más herramientas</span>
          {/* La flecha gira 180 grados cuando el desplegable está abierto. */}
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
