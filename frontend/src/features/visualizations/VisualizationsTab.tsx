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
import { useSources } from "../research/queries";
import type { ResearchCategory, Source, SourceType } from "../research/types";

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

const REVIEW_COLORS: Record<ReviewStatus, string> = {
  accepted: "#34d399",
  proposed: "#fbbf24",
  rejected: "#fb7185",
};

const REVIEW_ORDER: ReviewStatus[] = ["accepted", "proposed", "rejected"];
const COMPETITOR_COLORS = ["bg-rose-400", "bg-orange-400", "bg-amber-400", "bg-sky-400"];

interface CountBarEntry {
  label: string;
  count: number;
  color?: string;
}

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

function ReviewStatusChart({ counts }: { counts: Record<ReviewStatus, number> }) {
  const total = REVIEW_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
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

function sourcesByMonth(sources: Source[]) {
  const dates = sources
    .map((source) => new Date(source.created_at))
    .filter((date) => Number.isFinite(date.getTime()));
  if (dates.length === 0) return [];

  const latest = dates.reduce((newest, date) => (date > newest ? date : newest));
  const latestMonth = latest.getUTCFullYear() * 12 + latest.getUTCMonth();
  const firstMonth = latestMonth - 5;
  const counts = new Map<number, number>();

  dates.forEach((date) => {
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
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

export function VisualizationsTab() {
  const { project } = useProjectOutlet();
  const findings = useFindings(project.id, {});
  const competitors = useCompetitors(project.id);
  const sources = useSources(project.id);

  if (findings.isPending || competitors.isPending || sources.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Preparando visualizaciones…
      </div>
    );
  }

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
        <CountBarChart
          id="category-chart"
          title="Temas que aparecen"
          explanation="Te muestra qué temas —como mercado, clientes o competencia— aparecen más en la investigación."
          entries={categories.map((category) => ({ label: CATEGORY_LABELS[category], count: categoryCounts[category] }))}
          icon={FiBarChart2}
        />
        <ReviewStatusChart counts={reviewCounts} />
        <CountBarChart
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
        <CountBarChart
          id="sources-chart"
          title="De dónde viene la información"
          explanation="Resume qué tipos de sitios aportan información, por ejemplo noticias, gobierno o páginas académicas."
          entries={sourceTypes.map((type) => ({ label: SOURCE_TYPE_LABELS[type], count: sourceCounts[type] }))}
          icon={FiBookOpen}
        />
        <SourcesOverTimeChart points={sourceTimeline} />
      </div>
    </div>
  );
}
