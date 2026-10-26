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

const PAGE_SIZE = 12;

function isStatus(value: string | null): value is ProjectStatus {
  return value !== null && (PROJECT_STATUSES as string[]).includes(value);
}

export function ProjectsPage() {
  useDocumentTitle("Proyectos");
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get("estado");
  const status = isStatus(rawStatus) ? rawStatus : undefined;
  const page = Math.max(1, Number(searchParams.get("pagina")) || 1);

  const projects = useProjectList({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status });
  const totalPages = Math.max(1, Math.ceil((projects.data?.total ?? 0) / PAGE_SIZE));

  function update(next: { estado?: ProjectStatus; pagina?: number }) {
    const params = new URLSearchParams();
    if (next.estado) params.set("estado", next.estado);
    if (next.pagina && next.pagina > 1) params.set("pagina", String(next.pagina));
    setSearchParams(params);
  }

  const filters: Array<{ value?: ProjectStatus; label: string }> = [
    { label: "Todos" },
    ...PROJECT_STATUSES.map((value) => ({ value, label: STATUS_META[value].label })),
  ];

  return (
    <div className="flex flex-col gap-6">
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

        <div
          role="group"
          aria-label="Filtrar por estado"
          className="neo-inset flex flex-wrap items-center gap-1.5 self-start rounded-2xl p-1.5"
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-slate-400">
            <FiFilter aria-hidden="true" /> Etapa
          </span>
          {filters.map((filter) => {
            const active = filter.value === status;
            return (
              <button
                key={filter.label}
                type="button"
                aria-pressed={active}
                onClick={() => update({ estado: filter.value })}
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

      {projects.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.isError ? (
        <Alert>{errorMessageFrom(projects.error)}</Alert>
      ) : projects.data.items.length === 0 ? (
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
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.data.items.map((project) => (
              <ProjectCard key={project.id} project={project} showDeleteAction />
            ))}
          </div>
          {totalPages > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => update({ estado: status, pagina: page - 1 })}
                icon={<FiChevronLeft aria-hidden="true" />}
              >
                Anterior
              </Button>
              <span className="neo-inset rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-300 tabular-nums">
                Página {page} de {totalPages}
              </span>
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
