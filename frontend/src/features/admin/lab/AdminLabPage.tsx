import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  FiActivity,
  FiArrowLeft,
  FiBookOpen,
  FiGitBranch,
  FiMapPin,
  FiSearch,
} from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { LinkButton } from "../../../components/ui/LinkButton";
import { Select } from "../../../components/ui/Select";
import { Spinner } from "../../../components/ui/Spinner";
import { errorMessageFrom } from "../../../lib/formErrors";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { GeoMap } from "../../geo/GeoMap";
import { useGeocode } from "../../geo/queries";
import type { GeoBusiness, GeoPlace } from "../../geo/types";
import { PageHeader } from "../../projects/components/PageHeader";
import {
  useAdminLabMetrics,
  useAdminLabProjects,
  useAdminProjectTrace,
  useOptimizeProjectRoute,
  usePlanHypothesisBudget,
  useScheduleProjectValidation,
  useSearchProjectPlaces,
  useSearchProjectTrace,
} from "../queries";
import type {
  AdminLabProject,
  LabMetricPoint,
  LabRouteResult,
  ProjectTraceGraph,
  RouteAlgorithm,
  TraceAlgorithm,
  TraceGraphNode,
  TracePathResult,
  ValidationShift,
} from "../types";

const RADIUS_OPTIONS = [
  { value: "500", label: "500 m" },
  { value: "1000", label: "1 km" },
  { value: "2500", label: "2.5 km" },
  { value: "5000", label: "5 km" },
];

const ROUTE_ALGORITHMS: Array<{ value: RouteAlgorithm; label: string }> = [
  { value: "hill_climbing", label: "Hill Climbing" },
  { value: "genetic", label: "Algoritmo genético" },
  { value: "exact", label: "Óptimo exacto (máx. 8 lugares)" },
];

const SHIFT_OPTIONS: Array<{ value: ValidationShift; label: string }> = [
  { value: "matutino", label: "Matutino" },
  { value: "vespertino", label: "Vespertino" },
  { value: "nocturno", label: "Nocturno" },
];

type ChartSeries = { label: string; color: string; values: number[] };

function LineChart({
  points,
  series,
  label,
}: {
  points: LabMetricPoint[];
  series: ChartSeries[];
  label: string;
}) {
  const width = 760;
  const height = 220;
  const padding = 28;
  const maxValue = Math.max(1, ...series.flatMap((line) => line.values));
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const coordinates = (values: number[]) =>
    values.map((value, index) => {
      const x = padding + (values.length <= 1 ? 0 : (index / (values.length - 1)) * chartWidth);
      const y = height - padding - (value / maxValue) * chartHeight;
      return `${x},${y}`;
    });

  return (
    <figure className="neo-inset rounded-2xl p-3">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{label}</span>
        <span className="flex flex-wrap gap-3">
          {series.map((line) => (
            <span key={line.label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="size-2 rounded-full" style={{ backgroundColor: line.color }} />
              {line.label}
            </span>
          ))}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full overflow-visible"
        role="img"
        aria-label={label}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = height - padding - fraction * chartHeight;
          return (
            <g key={fraction}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.2)"
                strokeDasharray="4 5"
              />
              <text x={4} y={y + 4} fill="#94a3b8" fontSize="10">
                {Math.round(maxValue * fraction)}
              </text>
            </g>
          );
        })}
        {series.map((line) => (
          <g key={line.label}>
            <polyline
              points={coordinates(line.values).join(" ")}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {coordinates(line.values).map((point, index) => {
              const [rawX, rawY] = point.split(",");
              return (
                <circle
                  key={`${line.label}-${index}`}
                  cx={Number(rawX ?? 0)}
                  cy={Number(rawY ?? 0)}
                  r="3"
                  fill={line.color}
                  aria-label={`${points[index]?.day ?? ""}: ${line.values[index]} ${line.label}`}
                />
              );
            })}
          </g>
        ))}
        {points.length > 0 && (
          <>
            <text x={padding} y={height - 4} fill="#94a3b8" fontSize="10">
              {points[0]?.day.slice(5)}
            </text>
            <text x={width - padding} y={height - 4} fill="#94a3b8" fontSize="10" textAnchor="end">
              {points.at(-1)?.day.slice(5)}
            </text>
          </>
        )}
      </svg>
    </figure>
  );
}

function BarChart({
  points,
  series,
  label,
}: {
  points: LabMetricPoint[];
  series: ChartSeries[];
  label: string;
}) {
  const width = 760;
  const height = 220;
  const padding = 28;
  const maxValue = Math.max(1, ...series.flatMap((line) => line.values));
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const slotWidth = chartWidth / Math.max(1, points.length);
  const groupWidth = Math.min(32, slotWidth * 0.72);
  const gap = series.length > 1 ? 2 : 0;
  const barWidth = (groupWidth - gap * (series.length - 1)) / Math.max(1, series.length);

  return (
    <figure className="neo-inset rounded-2xl p-3">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{label}</span>
        <span className="flex flex-wrap gap-3">
          {series.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="size-2 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full overflow-visible"
        role="img"
        aria-label={label}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = height - padding - fraction * chartHeight;
          return (
            <g key={fraction}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.2)"
                strokeDasharray="4 5"
              />
              <text x={4} y={y + 4} fill="#94a3b8" fontSize="10">
                {Math.round(maxValue * fraction)}
              </text>
            </g>
          );
        })}
        {points.map((point, pointIndex) => {
          const center = padding + (pointIndex + 0.5) * slotWidth;
          const groupStart = center - groupWidth / 2;
          return (
            <g key={point.day}>
              {series.map((item, seriesIndex) => {
                const value = item.values[pointIndex] ?? 0;
                const barHeight = (value / maxValue) * chartHeight;
                const x = groupStart + seriesIndex * (barWidth + gap);
                const y = height - padding - barHeight;
                return (
                  <rect
                    key={item.label}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="2"
                    fill={item.color}
                  >
                    <title>{`${point.day}: ${item.label} ${value}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
        {points.length > 0 && (
          <>
            <text x={padding} y={height - 4} fill="#94a3b8" fontSize="10">
              {points[0]?.day.slice(5)}
            </text>
            <text x={width - padding} y={height - 4} fill="#94a3b8" fontSize="10" textAnchor="end">
              {points.at(-1)?.day.slice(5)}
            </text>
          </>
        )}
      </svg>
    </figure>
  );
}

function TraceResult({ result }: { result: TracePathResult }) {
  if (!result.found) {
    return (
      <p className="text-sm text-slate-400">
        No se encontró una ruta de trazabilidad hasta ese elemento.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400">
        {result.algorithm.toUpperCase()} · {result.expanded_count} nodos recorridos
      </p>
      <ol className="flex flex-col gap-2">
        {result.path.map((node, index) => (
          <li key={node.id} className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-violet/20 text-xs font-bold text-accent-violet">
              {index + 1}
            </span>
            <div className="neo-inset min-w-0 flex-1 rounded-xl p-3">
              <p className="text-[10px] font-semibold tracking-wider text-accent-cyan uppercase">
                {node.kind}
              </p>
              <p className="break-words text-sm text-slate-100">{node.label}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TraceOverview({ graph }: { graph: ProjectTraceGraph }) {
  return (
    <details className="neo-inset rounded-xl p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">
        Relaciones reales del proyecto ({graph.nodes.length} nodos · {graph.edges.length} vínculos)
      </summary>
      {graph.truncated && (
        <p className="mt-2 text-xs text-amber-200">
          El grafo se limitó para mantener la respuesta ligera; se muestran las relaciones más
          recientes.
        </p>
      )}
      <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto">
        {graph.edges.slice(0, 100).map((edge, index) => {
          const from = graph.nodes.find((node) => node.id === edge.source);
          const to = graph.nodes.find((node) => node.id === edge.target);
          return (
            <li key={`${edge.source}-${edge.target}-${index}`} className="text-xs text-slate-400">
              <span className="text-slate-200">{from?.label ?? edge.source}</span>
              <span className="px-2 text-accent-violet">— {edge.relation} →</span>
              <span className="text-slate-200">{to?.label ?? edge.target}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function ProjectPicker({
  projects,
  selectedId,
  onChange,
}: {
  projects: AdminLabProject[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select
      label="Proyecto de IdeaForge"
      value={selectedId}
      options={projects.map((project) => ({
        value: project.id,
        label: `${project.title} · ${project.owner_name} · ${project.status}`,
      }))}
      onChange={onChange}
    />
  );
}

function PlaceSelection({
  places,
  selectedIds,
  onToggle,
}: {
  places: GeoBusiness[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section aria-label="Lugares encontrados para el proyecto" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          Lugares OSM encontrados: {places.length}. Selecciona hasta 8 para planear una visita.
        </p>
        <Badge>{selectedIds.length} seleccionados</Badge>
      </div>
      <ul className="flex max-h-52 flex-col gap-2 overflow-auto">
        {places.map((place) => {
          const id = `${place.osm_type}:${place.osm_id}`;
          const checked = selectedIds.includes(id);
          return (
            <li key={id}>
              <label className="neo-inset flex cursor-pointer items-start gap-2 rounded-xl p-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && selectedIds.length >= 8}
                  onChange={() => onToggle(id)}
                  className="mt-1 accent-violet-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-100">{place.name}</span>
                  <span className="text-xs text-slate-400">
                    {place.subtype ?? place.category} · {place.latitude.toFixed(4)},{" "}
                    {place.longitude.toFixed(4)}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProjectRouteResult({ result }: { result: LabRouteResult }) {
  return (
    <div className="neo-inset flex flex-col gap-2 rounded-xl p-3">
      <div className="flex flex-wrap gap-2">
        <Badge>{result.algorithm.replaceAll("_", " ")}</Badge>
        <Badge>Ruta total aprox. {result.total_distance_km} km</Badge>
        <Badge>Óptimo exacto {result.optimal_reference_km} km</Badge>
      </div>
      <ol className="flex flex-col gap-1 text-sm text-slate-200">
        {result.stops.map((stop, index) => (
          <li key={`${stop.osm_type}-${stop.osm_id}`}>
            {index + 1}. {stop.name} · {stop.distance_from_previous_km} km desde el punto anterior
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-500">
        {result.distance_note} Regreso al punto seleccionado: {result.return_distance_km} km.
      </p>
    </div>
  );
}

function PaletteGroup({ title, colors }: { title: string; colors: string[] }) {
  return (
    <div className="neo-inset rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      <div className="flex gap-2">
        {colors.map((color) => (
          <span
            key={color}
            className="h-9 flex-1 rounded-lg border border-white/15"
            style={{ backgroundColor: color }}
            aria-label={`Muestra de color ${color}`}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

export function AdminLabPage() {
  useDocumentTitle("Laboratorio aplicado al proyecto");
  const projectList = useAdminLabProjects();
  const metrics = useAdminLabMetrics(30);
  const geocode = useGeocode();
  const tracePath = useSearchProjectTrace();
  const placeSearch = useSearchProjectPlaces();
  const routeOptimization = useOptimizeProjectRoute();

  const [projectId, setProjectId] = useState("");
  const [traceAlgorithm, setTraceAlgorithm] = useState<TraceAlgorithm>("bfs");
  const [traceTarget, setTraceTarget] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [lastGeocodeQuery, setLastGeocodeQuery] = useState("");
  const [locationMatches, setLocationMatches] = useState<GeoPlace[]>([]);
  const [center, setCenter] = useState<GeoPlace | null>(null);
  const [keyword, setKeyword] = useState("");
  const [radius, setRadius] = useState(1000);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [routeAlgorithm, setRouteAlgorithm] = useState<RouteAlgorithm>("hill_climbing");
  const [routeSeed, setRouteSeed] = useState(42);
  const [routePopulation, setRoutePopulation] = useState(24);
  const [routeGenerations, setRouteGenerations] = useState(30);

  const projects = projectList.data?.projects ?? [];
  const selectedProject = projects.find((project) => project.id === projectId);
  const trace = useAdminProjectTrace(projectId || null);
  const traceGraph = trace.data;
  const hypothesisNodes = useMemo(
    () => (traceGraph?.nodes ?? []).filter((node) => node.kind === "hypothesis"),
    [traceGraph],
  );
  const traceTargets = useMemo(
    () =>
      (traceGraph?.nodes ?? []).filter(
        (node) => node.id !== traceGraph?.root_id && node.kind !== "project",
      ),
    [traceGraph],
  );
  const geoPlaces = placeSearch.data?.places ?? [];

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0]!.id);
  }, [projectId, projects]);

  useEffect(() => {
    if (traceTargets.length > 0 && !traceTargets.some((node) => node.id === traceTarget)) {
      setTraceTarget(traceTargets[0]!.id);
    }
  }, [traceTarget, traceTargets]);

  const metricsSeries = useMemo(
    () => [
      {
        label: "Llamadas",
        color: "#a855f7",
        values: (metrics.data?.points ?? []).map((point) => point.calls),
      },
      {
        label: "Errores",
        color: "#f43f5e",
        values: (metrics.data?.points ?? []).map((point) => point.error_calls),
      },
    ],
    [metrics.data],
  );
  const tokenSeries = useMemo(
    () => [
      {
        label: "Entrada",
        color: "#22d3ee",
        values: (metrics.data?.points ?? []).map((point) => point.input_tokens),
      },
      {
        label: "Salida",
        color: "#c084fc",
        values: (metrics.data?.points ?? []).map((point) => point.output_tokens),
      },
    ],
    [metrics.data],
  );

  function selectProject(nextId: string) {
    setProjectId(nextId);
    setTraceTarget("");
    setCenter(null);
    setLocationQuery("");
    setLastGeocodeQuery("");
    setLocationMatches([]);
    setSelectedPlaceIds([]);
    tracePath.reset();
    placeSearch.reset();
    routeOptimization.reset();
  }

  async function geocodeProjectZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = locationQuery.trim();
    if (!query || geocode.isPending) return;
    setLastGeocodeQuery(query);
    setLocationMatches([]);
    try {
      const results = await geocode.mutateAsync(query);
      setLocationMatches(results);
      if (results.length === 1) setCenter(results[0]!);
    } catch {
      setLocationMatches([]);
    }
  }

  function pickMapCenter(latitude: number, longitude: number) {
    setCenter({
      place_id: `project-lab:${latitude.toFixed(5)}:${longitude.toFixed(5)}`,
      display_name: `Punto del proyecto (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      latitude,
      longitude,
      category: null,
      place_type: null,
    });
    placeSearch.reset();
    routeOptimization.reset();
    setSelectedPlaceIds([]);
  }

  function searchProjectPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !center || keyword.trim().length < 2) return;
    setSelectedPlaceIds([]);
    routeOptimization.reset();
    placeSearch.mutate({
      projectId,
      data: {
        latitude: center.latitude,
        longitude: center.longitude,
        radius_m: radius,
        keyword: keyword.trim(),
      },
    });
  }

  function submitRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !center || selectedPlaceIds.length < 2) return;
    routeOptimization.mutate({
      projectId,
      data: {
        latitude: center.latitude,
        longitude: center.longitude,
        radius_m: radius,
        keyword: keyword.trim(),
        selected_place_ids: selectedPlaceIds,
        algorithm: routeAlgorithm,
        seed: routeSeed,
        population_size: routePopulation,
        generations: routeGenerations,
      },
    });
  }

  function submitTracePath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !traceTarget) return;
    tracePath.mutate({ projectId, algorithm: traceAlgorithm, targetNodeId: traceTarget });
  }

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
        <PageHeader
          eyebrow="Centro de control · Herramientas aplicadas a IdeaForge"
          title="Análisis del proyecto"
          description="Explora la trazabilidad, los lugares de su zona y las hipótesis de validación del proyecto seleccionado. Los planes calculados son recomendaciones temporales y no cambian los datos guardados."
          actions={
            <>
              <LinkButton
                to="/admin/laboratorio/proposiciones"
                variant="secondary"
                size="sm"
                icon={<FiBookOpen aria-hidden="true" />}
              >
                Proposiciones y tablas
              </LinkButton>
              <LinkButton
                to="/admin"
                variant="secondary"
                size="sm"
                icon={<FiArrowLeft aria-hidden="true" />}
              >
                Administración
              </LinkButton>
            </>
          }
        />
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
        <header className="flex items-center gap-2">
          <FiGitBranch aria-hidden="true" className="text-accent-violet" />
          <div>
            <h2 className="font-display text-lg font-bold">Proyecto real de IdeaForge</h2>
            <p className="text-xs text-slate-400">
              Selecciona una idea existente; los algoritmos consultan solo sus registros
              relacionados.
            </p>
          </div>
        </header>
        {projectList.isPending ? (
          <div role="status" className="flex justify-center py-6">
            <Spinner className="size-5 text-accent-cyan" />
          </div>
        ) : projectList.isError ? (
          <Alert>{errorMessageFrom(projectList.error)}</Alert>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay proyectos para analizar.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <ProjectPicker projects={projects} selectedId={projectId} onChange={selectProject} />
            {selectedProject && (
              <div className="neo-inset rounded-xl p-3 text-sm">
                <p className="font-semibold text-slate-100">{selectedProject.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Estado: {selectedProject.status} · Propietario: {selectedProject.owner_name}
                </p>
                {selectedProject.geographic_scope && (
                  <p className="mt-1 text-xs text-slate-400">
                    Alcance geográfico confirmado: {selectedProject.geographic_scope}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {trace.isFetching && (
          <p role="status" className="flex items-center gap-2 text-xs text-slate-400">
            <Spinner className="size-4 text-accent-cyan" /> Construyendo el grafo real del proyecto…
          </p>
        )}
        {trace.isError && <Alert>{errorMessageFrom(trace.error)}</Alert>}
      </GlassPanel>

      <section aria-labelledby="lab-metrics-title" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FiActivity aria-hidden="true" className="text-accent-cyan" />
          <div>
            <h2 id="lab-metrics-title" className="font-display text-lg font-bold">
              Actividad real de la plataforma
            </h2>
            <p className="text-xs text-slate-400">
              Agregados diarios de <code>ai_api_logs</code>; no se muestran prompts ni respuestas.
            </p>
          </div>
          <Badge>Últimos 30 días</Badge>
        </div>
        {metrics.isPending ? (
          <div role="status" className="flex justify-center py-8">
            <Spinner className="size-5 text-accent-cyan" />
          </div>
        ) : metrics.isError ? (
          <Alert>{errorMessageFrom(metrics.error)}</Alert>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <GlassPanel className="rounded-3xl p-4">
              <BarChart
                points={metrics.data.points}
                series={metricsSeries}
                label="Llamadas y errores de IA por día"
              />
            </GlassPanel>
            <GlassPanel className="rounded-3xl p-4">
              <LineChart
                points={metrics.data.points}
                series={tokenSeries}
                label="Tokens de entrada y salida por día"
              />
            </GlassPanel>
          </div>
        )}
      </section>

      {projectId && traceGraph && (
        <>
          <div className="grid min-w-0 gap-6 2xl:grid-cols-2">
            <GlassPanel className="flex min-w-0 flex-col gap-4 rounded-3xl p-5 sm:p-6">
              <header>
                <h2 className="font-display text-lg font-bold">Trazabilidad del proyecto</h2>
                <p className="text-xs text-slate-400">
                  BFS encuentra el camino con menos vínculos; DFS explora en profundidad. El grafo
                  procede de sus atributos, fuentes, evidencias, hallazgos y análisis.
                </p>
              </header>
              <form
                onSubmit={submitTracePath}
                className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] 2xl:items-end"
              >
                <Select
                  label="Recorrido"
                  value={traceAlgorithm}
                  options={[
                    { value: "bfs", label: "Anchura (BFS)" },
                    { value: "dfs", label: "Profundidad (DFS)" },
                  ]}
                  onChange={(value) => setTraceAlgorithm(value as TraceAlgorithm)}
                />
                <Select
                  label="Buscar camino desde el proyecto hasta"
                  value={traceTarget}
                  options={traceTargets.map((node) => ({
                    value: node.id,
                    label: `${node.kind}: ${node.label.slice(0, 48)}${node.label.length > 48 ? "…" : ""}`,
                  }))}
                  onChange={setTraceTarget}
                  disabled={traceTargets.length === 0}
                  className="min-w-0"
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={tracePath.isPending}
                  disabled={!traceTarget}
                  className="sm:col-span-2 2xl:col-span-1"
                >
                  Buscar trazabilidad
                </Button>
              </form>
              {tracePath.isError && <Alert>{errorMessageFrom(tracePath.error)}</Alert>}
              {tracePath.data && <TraceResult result={tracePath.data} />}
              <TraceOverview graph={traceGraph} />
            </GlassPanel>

            <GlassPanel className="flex min-w-0 flex-col gap-4 rounded-3xl p-5 sm:p-6">
              <header className="flex items-center gap-2">
                <FiMapPin aria-hidden="true" className="text-accent-cyan" />
                <div>
                  <h2 className="font-display text-lg font-bold">Entorno geográfico del proyecto</h2>
                  <p className="text-xs text-slate-400">
                    Elige una ubicación en el mapa o búscala; consulta OSM solo al pulsar buscar.
                  </p>
                </div>
              </header>
              <form
                onSubmit={(event) => void geocodeProjectZone(event)}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
              >
                <input
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder={selectedProject?.geographic_scope ?? "Localidad o zona"}
                  maxLength={160}
                  autoComplete="off"
                  aria-label="Localidad o zona del proyecto"
                  className="neo-inset h-10 w-full min-w-0 rounded-xl px-3 text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={geocode.isPending}
                  disabled={locationQuery.trim().length < 3}
                  className="whitespace-nowrap"
                >
                  <FiSearch aria-hidden="true" /> Buscar zona
                </Button>
              </form>
              {geocode.isError && <Alert>{errorMessageFrom(geocode.error)}</Alert>}
              {!geocode.isPending &&
                lastGeocodeQuery === locationQuery.trim() &&
                geocode.isSuccess &&
                locationMatches.length === 0 &&
                geocode.data?.length === 0 && (
                  <p className="text-xs text-slate-400">No se encontraron zonas con ese nombre.</p>
                )}
              {locationMatches.length > 0 && (
                <div className="flex max-h-28 flex-col gap-1 overflow-auto">
                  {locationMatches.map((place) => (
                    <button
                      key={place.place_id}
                      type="button"
                      onClick={() => {
                        setCenter(place);
                        setLocationMatches([]);
                        placeSearch.reset();
                        routeOptimization.reset();
                        setSelectedPlaceIds([]);
                      }}
                      className="neo-inset rounded-lg p-2 text-left text-xs text-slate-200 hover:ring-1 hover:ring-accent-cyan/50"
                    >
                      {place.display_name}
                    </button>
                  ))}
                </div>
              )}
              <GeoMap
                center={center}
                places={geoPlaces}
                radiusM={radius}
                onSelectLocation={pickMapCenter}
              />
              <form
                onSubmit={searchProjectPlaces}
                className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] 2xl:grid-cols-[minmax(0,1fr)_9rem_auto] 2xl:items-end"
              >
                <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                  Negocio / competidor
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    maxLength={80}
                    placeholder="Ej.: Nutrisa, heladerías"
                    className="neo-inset h-10 w-full min-w-0 rounded-xl px-3 text-sm text-slate-100"
                  />
                </label>
                <Select
                  label="Radio"
                  value={String(radius)}
                  options={RADIUS_OPTIONS}
                  onChange={(value) => setRadius(Number(value))}
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={placeSearch.isPending}
                  disabled={!center || keyword.trim().length < 2}
                  className="sm:col-span-2 2xl:col-span-1"
                >
                  Buscar lugares
                </Button>
              </form>
              {placeSearch.isError && <Alert>{errorMessageFrom(placeSearch.error)}</Alert>}
              {placeSearch.data && (
                <PlaceSelection
                  places={placeSearch.data.places}
                  selectedIds={selectedPlaceIds}
                  onToggle={(id) =>
                    setSelectedPlaceIds((current) =>
                      current.includes(id)
                        ? current.filter((item) => item !== id)
                        : current.length < 8
                          ? [...current, id]
                          : current,
                    )
                  }
                />
              )}
              {placeSearch.data && (
                <form
                  onSubmit={submitRoute}
                  className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                >
                  <Select
                    label="Optimizar recorrido de visita"
                    value={routeAlgorithm}
                    options={ROUTE_ALGORITHMS}
                    onChange={(value) => setRouteAlgorithm(value as RouteAlgorithm)}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    loading={routeOptimization.isPending}
                    disabled={selectedPlaceIds.length < 2}
                  >
                    Optimizar visita
                  </Button>
                  {routeAlgorithm === "genetic" && (
                    <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                      <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                        Semilla
                        <input
                          type="number"
                          min={0}
                          max={2147483647}
                          value={routeSeed}
                          onChange={(event) => setRouteSeed(Number(event.target.value))}
                          className="neo-inset h-10 rounded-xl px-3 text-sm text-slate-100"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                        Población
                        <input
                          type="number"
                          min={4}
                          max={60}
                          value={routePopulation}
                          onChange={(event) => setRoutePopulation(Number(event.target.value))}
                          className="neo-inset h-10 rounded-xl px-3 text-sm text-slate-100"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                        Generaciones
                        <input
                          type="number"
                          min={1}
                          max={80}
                          value={routeGenerations}
                          onChange={(event) => setRouteGenerations(Number(event.target.value))}
                          className="neo-inset h-10 rounded-xl px-3 text-sm text-slate-100"
                        />
                      </label>
                    </div>
                  )}
                </form>
              )}
              {routeOptimization.isError && (
                <Alert>{errorMessageFrom(routeOptimization.error)}</Alert>
              )}
              {routeOptimization.data && <ProjectRouteResult result={routeOptimization.data} />}
            </GlassPanel>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <HypothesisBudgetPanel
              key={`budget-${projectId}`}
              projectId={projectId}
              hypotheses={hypothesisNodes}
            />
            <ValidationSchedulePanel
              key={`schedule-${projectId}`}
              projectId={projectId}
              hypotheses={hypothesisNodes}
            />
          </div>
        </>
      )}

      {!projectId && !projectList.isPending && projects.length === 0 && (
        <GlassPanel className="rounded-3xl p-6 text-sm text-slate-400">
          Crea un proyecto para explorar trazabilidad, hipótesis y lugares relacionados.
        </GlassPanel>
      )}

      <GlassPanel className="rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Paletas para visualizar datos del proyecto</h2>
        <p className="mt-1 text-xs text-slate-400">
          Muestrario basado en los colores actuales de IdeaForge; no son métricas simuladas.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PaletteGroup
            title="Categórica"
            colors={["#22d3ee", "#a855f7", "#f472b6", "#fbbf24", "#34d399"]}
          />
          <PaletteGroup
            title="Secuencial"
            colors={["#f5f3ff", "#c4b5fd", "#8b5cf6", "#6d28d9", "#2e1065"]}
          />
          <PaletteGroup
            title="Alto contraste"
            colors={["#f43f5e", "#fbbf24", "#22d3ee", "#34d399", "#e2e8f0"]}
          />
        </div>
      </GlassPanel>
    </div>
  );
}

function HypothesisBudgetPanel({
  projectId,
  hypotheses,
}: {
  projectId: string;
  hypotheses: TraceGraphNode[];
}) {
  const budgetPlan = usePlanHypothesisBudget();
  const [budget, setBudget] = useState(10000);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [estimates, setEstimates] = useState<Record<string, { cost: number; value: number }>>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    budgetPlan.mutate({
      projectId,
      data: {
        budget,
        algorithm: "hill_climbing",
        items: selectedIds.map((nodeId) => ({
          hypothesis_id: nodeId.slice("hypothesis:".length),
          estimated_cost: estimates[nodeId]?.cost ?? 0,
          expected_value: estimates[nodeId]?.value ?? 0,
        })),
      },
    });
  }

  return (
    <GlassPanel className="flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
      <header>
        <h2 className="font-display text-lg font-bold">Priorizar validaciones con presupuesto</h2>
        <p className="text-xs text-slate-400">
          Selecciona hipótesis reales del proyecto e indica estimaciones de costo y valor esperado.
        </p>
      </header>
      {hypotheses.length === 0 ? (
        <p className="text-sm text-slate-400">Este proyecto aún no tiene hipótesis de validación.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-slate-400">
            Presupuesto disponible (estimación tuya)
            <input
              type="number"
              min={0}
              max={10000000}
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
              className="neo-inset h-10 rounded-xl px-3 text-sm text-slate-100"
            />
          </label>
          <div className="flex max-h-72 flex-col gap-2 overflow-auto">
            {hypotheses.map((node) => {
              const selected = selectedIds.includes(node.id);
              const estimate = estimates[node.id] ?? { cost: 0, value: 0 };
              return (
                <div key={node.id} className="neo-inset rounded-xl p-3">
                  <label className="flex items-start gap-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        setSelectedIds((current) =>
                          selected
                            ? current.filter((id) => id !== node.id)
                            : current.length < 16
                              ? [...current, node.id]
                              : current,
                        )
                      }
                      className="mt-1 accent-violet-500"
                    />
                    <span>{node.label}</span>
                  </label>
                  {selected && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        aria-label={`Costo estimado: ${node.label}`}
                        placeholder="Costo"
                        value={estimate.cost}
                        onChange={(event) =>
                          setEstimates((current) => ({
                            ...current,
                            [node.id]: { ...estimate, cost: Number(event.target.value) },
                          }))
                        }
                        className="neo-inset h-9 rounded-lg px-2 text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`Valor esperado: ${node.label}`}
                        placeholder="Valor 0–100"
                        value={estimate.value}
                        onChange={(event) =>
                          setEstimates((current) => ({
                            ...current,
                            [node.id]: { ...estimate, value: Number(event.target.value) },
                          }))
                        }
                        className="neo-inset h-9 rounded-lg px-2 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!selectedIds.length}
            loading={budgetPlan.isPending}
          >
            Priorizar hipótesis
          </Button>
        </form>
      )}
      {budgetPlan.isError && <Alert>{errorMessageFrom(budgetPlan.error)}</Alert>}
      {budgetPlan.data && (
        <div className="neo-inset rounded-xl p-3 text-sm">
          <p className="font-semibold text-slate-100">
            Selección recomendada: {budgetPlan.data.total_value} puntos · costo{" "}
            {budgetPlan.data.total_cost} / {budgetPlan.data.budget}
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-400">
            {budgetPlan.data.selected.map((item) => (
              <li key={item.hypothesis_id}>{item.statement}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            La estimación de costo/valor la proporciona el administrador; la recomendación no se
            guarda.
          </p>
        </div>
      )}
    </GlassPanel>
  );
}

function ValidationSchedulePanel({
  projectId,
  hypotheses,
}: {
  projectId: string;
  hypotheses: TraceGraphNode[];
}) {
  const validationSchedule = useScheduleProjectValidation();
  const [capacity, setCapacity] = useState(4);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Record<string, ValidationShift>>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    validationSchedule.mutate({
      projectId,
      data: {
        capacity_per_shift: capacity,
        tasks: selectedIds.map((nodeId) => ({
          hypothesis_id: nodeId.slice("hypothesis:".length),
          preferred_shift: preferences[nodeId] ?? "matutino",
        })),
      },
    });
  }

  return (
    <GlassPanel className="flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
      <header>
        <h2 className="font-display text-lg font-bold">Plan de validación por turnos</h2>
        <p className="text-xs text-slate-400">
          Distribuye las hipótesis del proyecto en horarios disponibles; no utiliza datos de
          empleados.
        </p>
      </header>
      {hypotheses.length === 0 ? (
        <p className="text-sm text-slate-400">Añade hipótesis al análisis para crear un plan.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-slate-400">
            Capacidad máxima por turno
            <input
              type="number"
              min={1}
              max={8}
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              className="neo-inset h-10 rounded-xl px-3 text-sm text-slate-100"
            />
          </label>
          <div className="flex max-h-72 flex-col gap-2 overflow-auto">
            {hypotheses.map((node) => {
              const selected = selectedIds.includes(node.id);
              return (
                <div key={node.id} className="neo-inset rounded-xl p-3">
                  <label className="flex items-start gap-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        setSelectedIds((current) =>
                          selected
                            ? current.filter((id) => id !== node.id)
                            : current.length < 16
                              ? [...current, node.id]
                              : current,
                        )
                      }
                      className="mt-1 accent-violet-500"
                    />
                    <span>{node.label}</span>
                  </label>
                  {selected && (
                    <Select
                      className="mt-2"
                      label="Turno preferido"
                      value={preferences[node.id] ?? "matutino"}
                      options={SHIFT_OPTIONS}
                      onChange={(value) =>
                        setPreferences((current) => ({
                          ...current,
                          [node.id]: value as ValidationShift,
                        }))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!selectedIds.length || selectedIds.length > capacity * 3}
            loading={validationSchedule.isPending}
          >
            Organizar plan
          </Button>
        </form>
      )}
      {validationSchedule.isError && <Alert>{errorMessageFrom(validationSchedule.error)}</Alert>}
      {validationSchedule.data && (
        <ol className="neo-inset flex flex-col gap-2 rounded-xl p-3 text-sm">
          {validationSchedule.data.assignments.map((task) => (
            <li
              key={task.hypothesis_id}
              className="flex flex-col gap-1 sm:flex-row sm:justify-between"
            >
              <span className="text-slate-200">{task.statement}</span>
              <span className="text-xs text-accent-cyan">
                Prefería {task.preferred_shift}; asignada {task.assigned_shift}
              </span>
            </li>
          ))}
          <li className="border-t border-white/10 pt-2 text-xs text-slate-400">
            Preferencias satisfechas: {validationSchedule.data.satisfied_preferences} · puntaje{" "}
            {validationSchedule.data.priority_weighted_score} · temporal, no guardado
          </li>
        </ol>
      )}
    </GlassPanel>
  );
}
