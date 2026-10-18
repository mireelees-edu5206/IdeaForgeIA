import { useState } from "react";
import { FiBookOpen, FiExternalLink, FiRefreshCw } from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { EmptyState } from "../projects/components/EmptyState";
import { useProjectOutlet } from "../projects/outlet";
import { SourceTypeBadge } from "./components/badges";
import { safeHref } from "./constants";
import { useSources } from "./queries";

type Filter = "all" | "cited";

export function SourcesTab() {
  const { project } = useProjectOutlet();
  const sources = useSources(project.id);
  const [filter, setFilter] = useState<Filter>("all");

  if (sources.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando fuentes…
      </div>
    );
  }
  if (sources.isError) {
    return (
      <GlassPanel className="flex flex-col items-start gap-4 p-6">
        <Alert>{errorMessageFrom(sources.error)}</Alert>
        <Button variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={() => sources.refetch()}>
          Reintentar
        </Button>
      </GlassPanel>
    );
  }
  if (sources.data.length === 0) {
    return (
      <EmptyState
        icon={FiBookOpen}
        title="Todavía no hay fuentes"
        description="Las páginas que consulte la IA durante la investigación aparecerán aquí, sin duplicados."
      />
    );
  }

  const citedCount = sources.data.filter((s) => s.citation_count > 0).length;
  const maxCitations = Math.max(1, ...sources.data.map((s) => s.citation_count));
  const visible = filter === "cited" ? sources.data.filter((s) => s.citation_count > 0) : sources.data;
  const filters: Array<[Filter, string]> = [
    ["all", `Todas (${sources.data.length})`],
    ["cited", `Citadas (${citedCount})`],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fuentes</h2>
          <p className="text-sm text-slate-400">
            Todas las páginas consultadas en las investigaciones de este proyecto. Una fuente citada respalda al menos un
            fragmento de alguna respuesta.
          </p>
        </div>
        <div role="group" aria-label="Filtrar fuentes" className="flex gap-2">
          {filters.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "primary" : "secondary"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <GlassPanel className="stage-3d rounded-3xl p-3">
        <ul className="divide-y divide-slate-400/15">
          {visible.map((source) => {
            const href = safeHref(source.url);
            const title = source.title ?? source.domain;
            const densityPct = Math.round((source.citation_count / maxCitations) * 100);
            return (
              <li key={source.id} className="flex flex-col gap-2.5 px-3 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex min-w-0 items-center gap-1.5 font-medium break-all text-slate-100 hover:text-accent-cyan hover:underline"
                    >
                      {title}
                      <FiExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="sr-only">(se abre en una pestaña nueva)</span>
                    </a>
                  ) : (
                    <span className="font-medium break-all">{title}</span>
                  )}
                  <span className="font-mono-tech text-xs text-slate-400">
                    {source.domain} · encontrada {formatRelative(source.created_at)}
                  </span>
                  <div className="neo-inset h-1.5 w-full max-w-xs overflow-hidden rounded-full" aria-hidden="true">
                    <div
                      className={source.citation_count > 0 ? "filament-line h-full rounded-full" : "h-full w-0"}
                      style={{ width: `${source.citation_count > 0 ? Math.max(densityPct, 12) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <SourceTypeBadge type={source.source_type} />
                  <span className={cn(source.citation_count > 0 ? "font-semibold text-kind-evidence" : "text-slate-500")}>
                    {source.citation_count > 0
                      ? `Citada en ${source.citation_count} ${source.citation_count === 1 ? "pregunta" : "preguntas"}`
                      : "Consultada, no citada"}
                  </span>
                  {source.evidence_count > 0 && (
                    <span className="text-slate-400">
                      · {source.evidence_count} {source.evidence_count === 1 ? "fragmento" : "fragmentos"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </GlassPanel>
    </div>
  );
}
