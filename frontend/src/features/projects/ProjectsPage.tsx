/**
 * ARCHIVO: frontend/src/features/projects/ProjectsPage.tsx
 *
 * ¿Qué es?
 * La pantalla "Proyectos": la lista de todas las ideas de la persona, con filtros por etapa y paginación.
 * Es la página a la que llegas desde el menú lateral, en la dirección /proyectos.
 *
 * ¿Qué se ve en pantalla?
 * 1. Un encabezado con el título "Proyectos", una breve descripción y el botón "Nuevo proyecto".
 * 2. Una franja de filtros por etapa: "Todos", "Borrador", "Estructurado", "En investigación", "Analizado".
 *    El filtro activo se resalta y lo marca aria-pressed para los lectores de pantalla.
 * 3. Según el estado de la consulta:
 *    - Cargando: seis tarjetas de esqueleto (formas grises que imitan las tarjetas reales).
 *    - Error: una alerta con el mensaje del servidor.
 *    - Sin proyectos: un mensaje vacío. Si hay filtro, ofrece "Ver todos"; si no, invita a crear el primero.
 *    - Con proyectos: una cuadrícula de tarjetas, y si hay más de 12, una barra de paginación.
 *
 * ¿Dónde guarda el filtro y la página?
 * En la dirección del navegador, usando parámetros de búsqueda:
 *   /proyectos?estado=draft&pagina=2
 * Así, si recargas la página o compartes el enlace, se conserva el mismo filtro y la misma página.
 *
 * ¿Quién lo usa?
 * features/projects/routes.tsx y app/router.tsx (ruta "proyectos").
 */
import { FiChevronLeft, FiChevronRight, FiFilter, FiFolder, FiPlus } from "react-icons/fi";
import { useSearchParams } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { cn } from "../../lib/cn";
import { errorMessageFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { EmptyState } from "./components/EmptyState";
import { PageHeader } from "./components/PageHeader";
import { ProjectCard, ProjectCardSkeleton } from "./components/ProjectCard";
import { PROJECT_STATUSES, STATUS_META } from "./constants";
import { useProjectList } from "./queries";
import type { ProjectStatus } from "./types";

/** Cuántos proyectos caben en cada página. Cambiar este número cambia la paginación de toda la lista. */
const PAGE_SIZE = 12;

/**
 * Dice si un texto es una de las etapas válidas (draft, structured, researching o analyzed).
 *
 * Sirve para validar el parámetro "?estado=" de la dirección: si alguien escribe "?estado=xyz",
 * la función responde false y la lista muestra todos los proyectos en vez de romperse.
 *
 * Es un "type guard": cuando devuelve true, TypeScript también sabe que el valor es un ProjectStatus.
 */
function isStatus(value: string | null): value is ProjectStatus {
  return value !== null && (PROJECT_STATUSES as string[]).includes(value);
}

/**
 * Pantalla de la lista de proyectos. No recibe props: lee sus filtros de la dirección del navegador.
 */
export function ProjectsPage() {
  // Pone "Proyectos" en el título de la pestaña del navegador.
  useDocumentTitle("Proyectos");
  // searchParams: los parámetros de la dirección. setSearchParams: cambia esos parámetros y recarga la lista.
  const [searchParams, setSearchParams] = useSearchParams();
  // Lee el filtro de etapa de la dirección, por ejemplo "draft" en ?estado=draft.
  const rawStatus = searchParams.get("estado");
  // Solo acepta una etapa válida. Si el valor no sirve, queda "undefined" y se muestran todos.
  const status = isStatus(rawStatus) ? rawStatus : undefined;
  // Número de página, empezando en 1. "Number(...) || 1" convierte textos no numéricos en 1.
  // "Math.max(1, ...)" evita páginas 0 o negativas.
  const page = Math.max(1, Number(searchParams.get("pagina")) || 1);

  // Pide a la API solo la página actual. "offset" es cuántos proyectos saltar antes de empezar.
  const projects = useProjectList({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status });
  // Número total de páginas. Como mínimo es 1, aunque no haya proyectos.
  const totalPages = Math.max(1, Math.ceil((projects.data?.total ?? 0) / PAGE_SIZE));

  /**
   * Cambia los filtros y la página en la dirección del navegador.
   *
   * La página 1 no se escribe en la dirección (queda más limpio); solo aparece "pagina" si es mayor que 1.
   */
  function update(next: { estado?: ProjectStatus; pagina?: number }) {
    const params = new URLSearchParams();
    if (next.estado) params.set("estado", next.estado);
    if (next.pagina && next.pagina > 1) params.set("pagina", String(next.pagina));
    setSearchParams(params);
  }

  // Lista de botones de filtro. El primero, "Todos", no tiene value: significa "sin filtro".
  const filters: Array<{ value?: ProjectStatus; label: string }> = [
    { label: "Todos" },
    // Una entrada por etapa, con su nombre en español tomado de STATUS_META.
    ...PROJECT_STATUSES.map((value) => ({ value, label: STATUS_META[value].label })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Panel superior: encabezado y filtros. "stage-3d" es un efecto visual de profundidad. */}
      <GlassPanel className="stage-3d flex flex-col gap-5 rounded-3xl p-6">
        <PageHeader
          eyebrow="Portafolio de ideas"
          title="Proyectos"
          description="Filtra por etapa de madurez y entra directamente al paso que necesita atención."
          actions={
            <LinkButton to="/proyectos/nuevo" icon={<FiPlus aria-hidden="true" />}>
              Nuevo proyecto
            </LinkButton>
          }
        />

        {/* Grupo de botones de filtro. role="group" y aria-label los presentan como un conjunto para lectores de pantalla. */}
        <div
          role="group"
          aria-label="Filtrar por estado"
          className="neo-inset flex flex-wrap items-center gap-1.5 self-start rounded-2xl p-1.5"
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-slate-400">
            <FiFilter aria-hidden="true" /> Etapa
          </span>
          {filters.map((filter) => {
            // El filtro está activo si su valor coincide con el de la dirección. "Todos" está activo cuando no hay filtro.
            const active = filter.value === status;
            return (
              <button
                key={filter.label}
                type="button"
                // aria-pressed le dice al lector de pantalla si el botón está "presionado" (activo).
                aria-pressed={active}
                onClick={() => update({ estado: filter.value })}
                // "cn" arma las clases: el botón activo lleva un anillo de color y el inactivo cambia de color al pasar el mouse.
                className={cn(
                  "jelly min-h-11 rounded-xl px-3.5 text-xs font-semibold transition sm:text-sm",
                  active
                    ? "neo-raised text-accent-cyan ring-1 ring-accent-cyan/35"
                    : "text-slate-300 hover:bg-slate-400/10 hover:text-slate-100",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Contenido según el estado de la consulta. Se revisa en este orden: cargando, error, vacío, con datos. */}
      {projects.isPending ? (
        // Mientras carga: seis tarjetas de esqueleto para que la pantalla no salte al llegar los datos.
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.isError ? (
        <Alert>{errorMessageFrom(projects.error)}</Alert>
      ) : projects.data.items.length === 0 ? (
        // Lista vacía: el mensaje depende de si hay un filtro activo o no.
        status ? (
          <EmptyState
            icon={FiFilter}
            title="No hay proyectos con este estado"
            description="Prueba con otro filtro o revisa todos tus proyectos."
            action={
              <Button variant="secondary" onClick={() => update({})}>
                Ver todos
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={FiFolder}
            title="Todavía no tienes proyectos"
            description="Crea tu primer proyecto para empezar a estructurar e investigar tu idea."
          />
        )
      ) : (
        // Hay proyectos: la cuadrícula y, si hace falta, la paginación. <>...</> agrupa sin añadir un elemento al DOM.
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.data.items.map((project) => (
              // showDeleteAction permite borrar el proyecto desde su tarjeta (con confirmación).
              <ProjectCard key={project.id} project={project} showDeleteAction />
            ))}
          </div>
          {/* La paginación solo aparece si hay más de una página. */}
          {totalPages > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-center gap-3">
              {/* Anterior se desactiva en la primera página. Conserva el filtro actual al cambiar de página. */}
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => update({ estado: status, pagina: page - 1 })}
                icon={<FiChevronLeft aria-hidden="true" />}
              >
                Anterior
              </Button>
              {/* "tabular-nums" hace que los números tengan el mismo ancho y no "bailen" al cambiar. */}
              <span className="neo-inset rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-300 tabular-nums">
                Página {page} de {totalPages}
              </span>
              {/* Siguiente se desactiva en la última página. */}
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => update({ estado: status, pagina: page + 1 })}
              >
                Siguiente <FiChevronRight aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
