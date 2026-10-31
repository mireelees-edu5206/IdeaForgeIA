/** Resume resultados, revisión, alternativas, fuentes y actividad del proyecto visible. */
import type { IconType } from "react-icons";
import { FiBarChart2, FiBookOpen, FiPieChart, FiRefreshCw, FiTrendingUp, FiUsers } from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
import { errorMessageFrom } from "../../lib/formErrors";
import { EmptyState } from "../projects/components/EmptyState";
import { useProjectOutlet } from "../projects/outlet";
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, REVIEW_LABELS } from "../findings/constants";
import { useCompetitors, useFindings } from "../findings/queries";
import type { CompetitorType, ReviewStatus } from "../findings/types";
import { CATEGORY_LABELS, SOURCE_TYPE_LABELS } from "../research/constants";
import { PieChart } from "../../components/ui/PieChart";
import { useSources } from "../research/queries";
import type { ResearchCategory, Source, SourceType } from "../research/types";

/** Configuracion visual de CATEGORY_COLORS para ubicar colores/animaciones de graficas. */
const CATEGORY_COLORS = [
  "bg-cyan-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-violet-400",
  "bg-rose-400",
  "bg-sky-400",
  "bg-orange-400",
  "bg-slate-400",
];

/** Configuracion visual de REVIEW_COLORS para ubicar colores/animaciones de graficas. */
const REVIEW_COLORS: Record<ReviewStatus, string> = {
  accepted: "#34d399",
  proposed: "#fbbf24",
  rejected: "#fb7185",
};

/** Catalogo REVIEW_ORDER que define etiquetas o reglas de graficas. */
const REVIEW_ORDER: ReviewStatus[] = ["accepted", "proposed", "rejected"];
/** Configuracion visual de COMPETITOR_COLORS para ubicar colores/animaciones de graficas. */
const COMPETITOR_COLORS = ["bg-rose-400", "bg-orange-400", "bg-amber-400", "bg-sky-400"];

/*
 * ─── TIPO DE CADA GRÁFICA (cambia aquí si el profesor pide otra gráfica) ───
 * Para cambiar una gráfica, escribe otra palabra entre comillas. Nada más:
 *   "barras" → gráfica de barras (la original en la mayoría de los casos)
 *   "pastel" → gráfica de pastel (rebanadas)
 *   "dona"   → pastel con hueco en el centro
 *   "lineas" → solo para "Fuentes consultadas con el tiempo": línea por mes (original)
 *
 * Ejemplo: para que "Temas que aparecen" sea pastel, escribe:
 *   const TIPO_TEMAS = "pastel" as TipoGrafica;
 *
 * Las palabras "as TipoGrafica" solo le dicen a la computadora que la palabra puede cambiar.
 * No las quites.
 */
type TipoGrafica = "barras" | "pastel" | "dona";
type TipoTiempo = "lineas" | "barras";

/** Gráfica "Temas que aparecen". Valores: "barras", "pastel", "dona". */
const TIPO_TEMAS = "barras" as TipoGrafica;
/** Gráfica "Alternativas encontradas". Valores: "barras", "pastel", "dona". */
const TIPO_ALTERNATIVAS = "barras" as TipoGrafica;
/** Gráfica "De dónde viene la información". Valores: "barras", "pastel", "dona". */
const TIPO_FUENTES = "barras" as TipoGrafica;
/** Gráfica "Revisión de resultados". "dona" es la original; también sirven "barras" y "pastel". */
const TIPO_REVISION = "dona" as TipoGrafica;
/** Gráfica "Fuentes consultadas con el tiempo". "lineas" es la original; "barras" muestra un barra por mes. */
const TIPO_TIEMPO = "lineas" as TipoTiempo;
/* ─── FIN DEL SELECTOR DE TIPO ─── */

/** Contrato de datos CountBarEntry utilizado por graficas. */
interface CountBarEntry {
  label: string;
  count: number;
  color?: string;
}

/** Componente CountBarChart: renderiza la vista de graficas. */
function CountBarChart({
  id,
  title,
  explanation,
  entries,
  icon: Icon,
}: {
  id: string;
  title: string;
  explanation: string;
  entries: CountBarEntry[];
  icon: IconType;
}) {
  const maxCount = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <GlassPanel role="region" aria-labelledby={`${id}-title`} className="stage-3d flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h3 id={`${id}-title`} className="font-semibold">{title}</h3>
          <p className="text-xs leading-relaxed text-slate-400">{explanation}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3" aria-label={title}>
        {entries.map(({ label, count, color }, index) => {
          return (
            <li key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-xs">
              <span className="truncate text-slate-300">{label}</span>
              <span className="neo-inset h-2 overflow-hidden rounded-full">
                <span
                  aria-hidden="true"
                  className={`block h-full rounded-full transition-[width] duration-500 ${color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`}
                  style={{ width: `${count === 0 ? 0 : Math.max(5, (count / maxCount) * 100)}%` }}
                />
              </span>
              <span className="text-right font-mono-tech text-slate-200">{count}</span>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}

/** Componente ReviewStatusChart: renderiza la vista de graficas. */
function ReviewStatusChart({ counts }: { counts: Record<ReviewStatus, number> }) {
  const total = REVIEW_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // SVG consume los segmentos como arcos continuos: cada offset inicia donde terminó el anterior.
  let offset = 0;

  return (
    <GlassPanel role="region" aria-labelledby="review-chart-title" className="stage-3d flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-violet">
          <FiPieChart aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h3 id="review-chart-title" className="font-semibold">Revisión de resultados</h3>
          <p className="text-xs leading-relaxed text-slate-400">
            Muestra cuántos aceptaste, rechazaste o todavía tienes pendientes de revisar.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        <div className="relative size-40 shrink-0">
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Distribución de revisión: ${REVIEW_ORDER.map((status) => `${REVIEW_LABELS[status]} ${counts[status]}`).join(", ")}`}
            className="size-full -rotate-90"
          >
            <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-400/15" />
            {total > 0 &&
              REVIEW_ORDER.map((status) => {
                const segment = (counts[status] / total) * circumference;
                const circle = (
                  <circle
                    key={status}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={REVIEW_COLORS[status]}
                    strokeWidth="12"
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                  />
                );
                offset += segment;
                return circle;
              })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold">{total}</span>
            <span className="text-[10px] text-slate-400">resultados</span>
          </div>
        </div>
        <ul className="flex w-full flex-col gap-3 sm:w-auto" aria-label="Leyenda del estado de revisión">
          {REVIEW_ORDER.map((status) => (
            <li key={status} className="flex items-center justify-between gap-6 text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: REVIEW_COLORS[status] }} />
                {REVIEW_LABELS[status]}
              </span>
              <span className="font-mono-tech font-semibold text-slate-100">{counts[status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </GlassPanel>
  );
}

/** Gestiona sources by month de graficas. */
function sourcesByMonth(sources: Source[]) {
  // Agrupa por meses UTC para que el gráfico no cambie según la zona horaria del navegador.
  const dates = sources
    .map((source) => new Date(source.created_at))
    .filter((date) => Number.isFinite(date.getTime()));
  /** Rama condicional: dates.length === 0. */
  if (dates.length === 0) return [];

  const latest = dates.reduce((newest, date) => (date > newest ? date : newest));
  const latestMonth = latest.getUTCFullYear() * 12 + latest.getUTCMonth();
  const firstMonth = latestMonth - 5;
  const counts = new Map<number, number>();

  dates.forEach((date) => {
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
    /** Rama condicional: month >= firstMonth && month <= latestMonth. */
    if (month >= firstMonth && month <= latestMonth) {
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
  });

  const monthLabel = new Intl.DateTimeFormat("es-MX", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

  return Array.from({ length: 6 }, (_, index) => {
    const month = firstMonth + index;
    const date = new Date(Date.UTC(Math.floor(month / 12), month % 12, 1));
    return {
      label: monthLabel.format(date).replace(".", ""),
      count: counts.get(month) ?? 0,
    };
  });
}

/** Componente SourcesOverTimeChart: renderiza la vista de graficas. */
function SourcesOverTimeChart({ points }: { points: ReturnType<typeof sourcesByMonth> }) {
  const width = 440;
  const height = 230;
  const left = 40;
  const right = 18;
  const top = 20;
  const bottom = 174;
  const chartWidth = width - left - right;
  const chartHeight = bottom - top;
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const coordinates = points.map((point, index) => ({
    ...point,
    x: left + (index / Math.max(1, points.length - 1)) * chartWidth,
    y: bottom - (point.count / maxCount) * chartHeight,
  }));
  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const ticks = [...new Set([0, Math.ceil(maxCount / 3), Math.ceil((maxCount * 2) / 3), maxCount])];

  return (
    <GlassPanel role="region" aria-labelledby="sources-over-time-title" className="stage-3d flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
          <FiTrendingUp aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h3 id="sources-over-time-title" className="font-semibold">Fuentes consultadas con el tiempo</h3>
          <p className="text-xs leading-relaxed text-slate-400">
            Muestra cuándo se reunió más información, mes a mes, durante los últimos seis meses de actividad.
          </p>
        </div>
      </div>
      {coordinates.length === 0 ? (
        <p className="neo-inset rounded-xl px-4 py-8 text-center text-sm text-slate-400">
          Al investigar este proyecto aparecerá aquí el ritmo con que se encontraron fuentes.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Fuentes consultadas por mes: ${coordinates.map((point) => `${point.label}: ${point.count}`).join(", ")}`}
            className="w-full overflow-visible"
          >
            {ticks.map((tick) => {
              const y = bottom - (tick / maxCount) * chartHeight;
              return (
                <g key={tick}>
                  <line x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" className="text-slate-400/20" />
                  <text x={left - 10} y={y + 4} textAnchor="end" className="fill-current text-[10px] text-slate-400">
                    {tick}
                  </text>
                </g>
              );
            })}
            <path d={line} fill="none" stroke="var(--color-accent-cyan)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {coordinates.map((point) => (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="5" fill="var(--color-accent-cyan)" />
                <text
                  x={point.x}
                  y={bottom + 24}
                  textAnchor="middle"
                  className="fill-current text-[10px] text-slate-400"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
          <ul className="sr-only" aria-label="Fuentes encontradas por mes">
            {coordinates.map((point) => <li key={point.label}>{point.label}: {point.count}</li>)}
          </ul>
        </>
      )}
    </GlassPanel>
  );
}

/** Datos que necesita cualquier gráfica de conteo. Son los mismos para barras, pastel o dona. */
type CountChartProps = {
  id: string;
  title: string;
  explanation: string;
  entries: CountBarEntry[];
  icon: IconType;
};

/**
 * CountChart decide qué dibujo mostrar según el tipo elegido en los selectores TIPO_* de arriba.
 * Recibe los mismos datos en los tres casos, por eso cambiar el tipo no requiere tocar nada más.
 */
function CountChart({ tipo, ...props }: CountChartProps & { tipo: TipoGrafica }) {
  // "barras" usa la gráfica de barras original.
  if (tipo === "barras") return <CountBarChart {...props} />;
  // "pastel" y "dona" usan el componente de pastel; "dona" activa el hueco del centro.
  return <PieChart {...props} donut={tipo === "dona"} />;
}

/** Expone la funcion visualizations tab para el flujo de visualizations. */
export function VisualizationsTab() {
  const { project } = useProjectOutlet();
  const findings = useFindings(project.id, {});
  const competitors = useCompetitors(project.id);
  const sources = useSources(project.id);

  /** Rama condicional: findings.isPending || competitors.isPending || sources.. */
  if (findings.isPending || competitors.isPending || sources.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Preparando visualizaciones…
      </div>
    );
  }

  /** Rama condicional: findings.isError || competitors.isError || sources.isEr. */
  if (findings.isError || competitors.isError || sources.isError) {
    const error = findings.error ?? competitors.error ?? sources.error;
    return (
      <GlassPanel className="flex flex-col items-start gap-4 p-6">
        <Alert>{errorMessageFrom(error)}</Alert>
        <Button
          variant="secondary"
          icon={<FiRefreshCw aria-hidden="true" />}
          onClick={() => void Promise.all([findings.refetch(), competitors.refetch(), sources.refetch()])}
        >
          Reintentar
        </Button>
      </GlassPanel>
    );
  }

  const categories = Object.keys(CATEGORY_LABELS) as ResearchCategory[];
  const sourceTypes = Object.keys(SOURCE_TYPE_LABELS) as SourceType[];
  const categoryCounts = Object.fromEntries(categories.map((category) => [category, 0])) as Record<
    ResearchCategory,
    number
  >;
  const reviewCounts = Object.fromEntries(
    REVIEW_ORDER.map((status) => [status, findings.data.filter((finding) => finding.review_status === status).length]),
  ) as Record<ReviewStatus, number>;
  findings.data.forEach((finding) => {
    categoryCounts[finding.finding_type] += 1;
  });

  const activeCompetitors = competitors.data.filter((competitor) => competitor.review_status !== "rejected");
  const competitorCounts = Object.fromEntries(COMPETITOR_TYPES.map((type) => [type, 0])) as Record<
    CompetitorType,
    number
  >;
  activeCompetitors.forEach((competitor) => {
    competitorCounts[competitor.competitor_type] += 1;
  });

  const sourceCounts = Object.fromEntries(sourceTypes.map((type) => [type, 0])) as Record<SourceType, number>;
  sources.data.forEach((source) => {
    sourceCounts[source.source_type] += 1;
  });
  const sourceTimeline = sourcesByMonth(sources.data);
  const hasData = findings.data.length + activeCompetitors.length + sources.data.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold">Visualizaciones del proyecto</h2>
        <p className="text-sm text-slate-400">
          Una vista sencilla de la investigación, las fuentes y las alternativas de{" "}
          <span className="font-medium text-slate-200">{project.title}</span>.
        </p>
      </header>
      {!hasData && (
        <EmptyState
          icon={FiBarChart2}
          title="Aún no hay datos para graficar"
          description="Al investigar la idea, los gráficos mostrarán qué se encontró y qué falta revisar."
        />
      )}
      <div className="grid gap-5 2xl:grid-cols-2">
        <CountChart
          tipo={TIPO_TEMAS}
          id="category-chart"
          title="Temas que aparecen"
          explanation="Te muestra qué temas —como mercado, clientes o competencia— aparecen más en la investigación."
          entries={categories.map((category) => ({ label: CATEGORY_LABELS[category], count: categoryCounts[category] }))}
          icon={FiBarChart2}
        />
        {TIPO_REVISION === "dona" ? (
          <ReviewStatusChart counts={reviewCounts} />
        ) : (
          <CountChart
            tipo={TIPO_REVISION}
            id="review-chart"
            title="Revisión de resultados"
            explanation="Muestra cuántos aceptaste, rechazaste o todavía tienes pendientes de revisar."
            entries={REVIEW_ORDER.map((status) => ({ label: REVIEW_LABELS[status], count: reviewCounts[status] }))}
            icon={FiPieChart}
          />
        )}
        <CountChart
          tipo={TIPO_ALTERNATIVAS}
          id="competitor-chart"
          title="Alternativas encontradas"
          explanation="Compara las opciones parecidas o sustitutas que siguen en revisión. Las descartadas no se cuentan."
          entries={COMPETITOR_TYPES.map((type, index) => ({
            label: COMPETITOR_TYPE_META[type].label,
            count: competitorCounts[type],
            color: COMPETITOR_COLORS[index],
          }))}
          icon={FiUsers}
        />
        <CountChart
          tipo={TIPO_FUENTES}
          id="sources-chart"
          title="De dónde viene la información"
          explanation="Resume qué tipos de sitios aportan información, por ejemplo noticias, gobierno o páginas académicas."
          entries={sourceTypes.map((type) => ({ label: SOURCE_TYPE_LABELS[type], count: sourceCounts[type] }))}
          icon={FiBookOpen}
        />
        {TIPO_TIEMPO === "lineas" ? (
          <SourcesOverTimeChart points={sourceTimeline} />
        ) : (
          <CountChart
            tipo="barras"
            id="sources-over-time"
            title="Fuentes consultadas con el tiempo"
            explanation="Muestra cuándo se reunió más información, mes a mes, durante los últimos seis meses de actividad."
            entries={sourceTimeline.map((point) => ({ label: point.label, count: point.count }))}
            icon={FiTrendingUp}
          />
        )}
      </div>
    </div>
  );
}
