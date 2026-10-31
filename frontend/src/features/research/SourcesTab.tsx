/**
 * ARCHIVO: research/SourcesTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Fuentes": la lista de todas las páginas de internet que se consultaron en las
 * investigaciones del proyecto, sin repetir ninguna.
 *
 * ¿Para qué sirve?
 * Permite revisar de dónde viene la información. Cada fuente muestra su tipo, cuántas preguntas la
 * citaron y cuántos fragmentos aportó. Con el filtro "Citadas" se ven solo las que sí respaldan
 * alguna respuesta.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "fuentes").
 *
 * Diferencia importante: una fuente "citada" respalda al menos un fragmento de respuesta; una
 * "consultada, no citada" se leyó pero no aportó texto.
 */

/* "useState" guarda cuál filtro está activo ("todas" o "citadas"). */
import { useState } from "react";
/* Iconos: libro (sin fuentes), enlace externo y recargar. */
import { FiBookOpen, FiExternalLink, FiRefreshCw } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
/* Une clases de estilo, da formato relativo a las fechas ("hace 3 días") y convierte errores a texto. */
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
/* Mensaje de "todavía no hay nada". */
import { EmptyState } from "../projects/components/EmptyState";
/* El proyecto que entregó el detalle a esta pestaña. */
import { useProjectOutlet } from "../projects/outlet";
/* La etiqueta del tipo de fuente. */
import { SourceTypeBadge } from "./components/badges";
/* La función que valida que el enlace sea seguro (http o https). */
import { safeHref } from "./constants";
/* La consulta que trae las fuentes desde la caché. */
import { useSources } from "./queries";

/**
 * Filter es la lista de filtros posibles: "all" (todas) o "cited" (solo las citadas).
 */
/** Contrato de datos Filter utilizado por investigacion. */
type Filter = "all" | "cited";

/**
 * SourcesTab dibuja la pestaña completa, con sus casos de carga, error, vacío y lista.
 *
 * No recibe datos: toma el proyecto de la pestaña padre y las fuentes de la caché.
 */
/** Expone la funcion sources tab para el flujo de research. */
export function SourcesTab() {
  // El proyecto que entregó el detalle.
  const { project } = useProjectOutlet();
  // Las fuentes del proyecto (con su estado de carga, error o datos).
  const sources = useSources(project.id);
  // El filtro activo. Empieza mostrando todas.
  const [filter, setFilter] = useState<Filter>("all");

  // Caso 1: todavía cargando. Mostramos la ruedita.
  /** Rama condicional: sources.isPending. */
  if (sources.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando fuentes…
      </div>
    );
  }
  // Caso 2: hubo error. Mostramos el motivo y un botón para reintentar.
  /** Rama condicional: sources.isError. */
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
  // Caso 3: no hay fuentes todavía. Mensaje de orientación.
  /** Rama condicional: sources.data.length === 0. */
  if (sources.data.length === 0) {
    return (
      <EmptyState
        icon={FiBookOpen}
        title="Todavía no hay fuentes"
        description="Las páginas que consulte la IA durante la investigación aparecerán aquí, sin duplicados."
      />
    );
  }

  // Cuántas fuentes están citadas (al menos una vez).
  const citedCount = sources.data.filter((s) => s.citation_count > 0).length;
  // El mayor número de citas de cualquier fuente. Se usa para dibujar la barra de cada una en proporción.
  // "Math.max(1, ...)" evita dividir entre cero si nadie fue citada.
  const maxCitations = Math.max(1, ...sources.data.map((s) => s.citation_count));
  // La lista que se muestra: todas, o solo las citadas, según el filtro.
  const visible = filter === "cited" ? sources.data.filter((s) => s.citation_count > 0) : sources.data;
  // Los dos botones de filtro, con su texto y el número entre paréntesis.
  const filters: Array<[Filter, string]> = [
    ["all", `Todas (${sources.data.length})`],
    ["cited", `Citadas (${citedCount})`],
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* La cabecera: título, explicación y los dos botones de filtro. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fuentes</h2>
          <p className="text-sm text-slate-400">
            Todas las páginas consultadas en las investigaciones de este proyecto. Una fuente citada respalda al menos un
            fragmento de alguna respuesta.
          </p>
        </div>
        <div role="group" aria-label="Filtrar fuentes" className="flex gap-2">
          {/* Cada botón de filtro. El activo se pinta en color principal; el otro, en secundario. */}
          {filters.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "primary" : "secondary"}
              // "aria-pressed" le dice al lector de pantalla si este botón está activado.
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* La lista de fuentes dentro de una tarjeta de cristal. "divide-y" pone una línea entre cada fila. */}
      <GlassPanel className="stage-3d rounded-3xl p-3">
        <ul aria-label="Fuentes consultadas" className="divide-y divide-slate-400/15">
          {visible.map((source) => {
            // Dirección segura, o null si no lo es (entonces el título no es enlace).
            const href = safeHref(source.url);
            // El título de la página, o el dominio si no tiene título.
            const title = source.title ?? source.domain;
            // Qué porcentaje de las citas máximas tiene esta fuente (para la barra). Redondeado a entero.
            const densityPct = Math.round((source.citation_count / maxCitations) * 100);
            return (
              <li key={source.id} className="flex flex-col gap-2.5 px-3 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {href ? (
                    // Enlace que se abre en pestaña nueva.
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
                    // Dirección no segura: solo texto.
                    <span className="font-medium break-all">{title}</span>
                  )}
                  {/* El dominio y cuándo se encontró la fuente, en letra de código. */}
                  <span className="font-mono-tech text-xs text-slate-400">
                    {source.domain} · encontrada {formatRelative(source.created_at)}
                  </span>
                  {/* La barrita de uso: más larga cuando la fuente fue citada más veces. Es solo decorativa (aria-hidden). */}
                  <div className="neo-inset h-1.5 w-full max-w-xs overflow-hidden rounded-full" aria-hidden="true">
                    <div
                      // Con citas: barra de color con el degradado de hilo. Sin citas: vacía.
                      className={source.citation_count > 0 ? "filament-line h-full rounded-full" : "h-full w-0"}
                      // Con citas, al menos 12 % de ancho para que se vea aunque sea poca cosa.
                      style={{ width: `${source.citation_count > 0 ? Math.max(densityPct, 12) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <SourceTypeBadge type={source.source_type} />
                  {/* Texto de citas en verde si fue citada, gris si no. Singular o plural según el número. */}
                  <span className={cn(source.citation_count > 0 ? "font-semibold text-kind-evidence" : "text-slate-500")}>
                    {source.citation_count > 0
                      ? `Citada en ${source.citation_count} ${source.citation_count === 1 ? "pregunta" : "preguntas"}`
                      : "Consultada, no citada"}
                  </span>
                  {/* Cuántos fragmentos aportó, solo si aportó alguno. */}
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
