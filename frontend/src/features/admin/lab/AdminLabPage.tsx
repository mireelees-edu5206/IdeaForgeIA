/**
 * ARCHIVO: admin/lab/AdminLabPage.tsx
 *
 * ¿Qué es?
 * Es la pantalla principal del "Laboratorio de algoritmos" (ruta "/admin/laboratorio"). Es el lugar
 * donde el administrador prueba, con datos reales de un proyecto, cómo funcionan los algoritmos de
 * búsqueda, de rutas y de presupuesto. Es el archivo más grande del área de administración.
 *
 * ¿Para qué sirve?
 * Para entender y comparar métodos. Los resultados son sugerencias temporales: esta pantalla NO
 * cambia los datos guardados del proyecto (los resultados de rutas, presupuesto y calendario
 * tampoco se guardan; el servidor responde "persisted: false").
 *
 * ¿Quién la usa?
 * Solo administradores (la ruta está protegida por RequireAdmin en app/router.tsx). Desde aquí se
 * llega a AdminLabLogicPage (proposiciones) y al panel de AdminPage.
 *
 * Partes de la pantalla, de arriba hacia abajo:
 * 1. Encabezado con botones para volver y para ver las proposiciones.
 * 2. "¿Qué es este laboratorio?": tarjetas con la guía de cada método (ALGORITHM_GUIDE).
 * 3. "Proyecto real de IdeaForge": el selector de proyecto.
 * 4. "Actividad real de la plataforma": dos gráficas de métricas de IA de los últimos 30 días.
 * 5. Por proyecto elegido:
 *    - Trazabilidad: buscar un camino en el grafo de relaciones del proyecto (TraceResult).
 *    - Entorno geográfico: buscar una zona, elegir lugares en el mapa, y ordenar la visita (ProjectRouteResult).
 *    - Priorizar validaciones con presupuesto (HypothesisBudgetPanel).
 *    - Plan de validación por turnos (ValidationSchedulePanel).
 * 6. Paletas de colores de muestra.
 *
 * Archivos que usa:
 * - queries.ts y api.ts: las peticiones al servidor.
 * - labFormat.ts: los nombres en español, la guía y el formato de distancias.
 * - ../geo: el mapa (GeoMap) y la búsqueda de zonas (useGeocode).
 * - components/ui/PieChart.tsx: las gráficas de pastel de la actividad (cambiables con TIPO_LLAMADAS y TIPO_TOKENS).
 */

/* "useEffect" hace algo cuando cambian datos. "useMemo" guarda un cálculo para no repetirlo.
   "useState" guarda lo que escribe o elige la persona. "FormEvent" es el tipo del evento de enviar un formulario. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
/* Iconos: actividad, flecha, libro, rama de git, pin de mapa, gráfica de pastel y lupa. */
import {
  FiActivity,
  FiArrowLeft,
  FiBookOpen,
  FiGitBranch,
  FiMapPin,
  FiPieChart,
  FiSearch,
} from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { PieChart } from "../../../components/ui/PieChart";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { LinkButton } from "../../../components/ui/LinkButton";
import { Select } from "../../../components/ui/Select";
import { Spinner } from "../../../components/ui/Spinner";
/* Convierte errores a texto y pone el título de la pestaña del navegador. */
import { errorMessageFrom } from "../../../lib/formErrors";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
/* El mapa, la búsqueda de zonas y los tipos de lugares (carpeta de geografía). */
import { GeoMap } from "../../geo/GeoMap";
import { useGeocode } from "../../geo/queries";
import type { GeoBusiness, GeoPlace } from "../../geo/types";
/* Cabecera de página compartida (carpeta de proyectos). */
import { PageHeader } from "../../projects/components/PageHeader";
/* Las consultas y acciones del laboratorio, desde la caché. */
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
/* Las fichas de forma de los datos del laboratorio. */
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
  BudgetAlgorithm,
} from "../types";
/* Los nombres en español, la guía y el formato de distancias. */
import {
  ALGORITHM_GUIDE,
  BUDGET_ALGORITHM_LABELS,
  formatDistance,
  ROUTE_ALGORITHM_LABELS,
  TRACE_ALGORITHM_LABELS,
} from "./labFormat";

/**
 * RADIUS_OPTIONS son los radios que se pueden elegir al buscar lugares: 500 m, 1 km, 2.5 km y 5 km.
 * El valor se guarda como texto ("500") porque así lo pide el menú; luego se convierte a número.
 * El servidor acepta radios entre 100 y 5000 metros.
 */
/** Define RADIUS_OPTIONS para el bloque de administracion. */
const RADIUS_OPTIONS = [
  { value: "500", label: "500 m" },
  { value: "1000", label: "1 km" },
  { value: "2500", label: "2.5 km" },
  { value: "5000", label: "5 km" },
];

/**
 * ROUTE_ALGORITHMS arma la lista del menú de métodos de ruta. Toma las llaves de ROUTE_ALGORITHM_LABELS
 * (exact, nearest_neighbor, etc.) y las convierte en pares { value, label } que espera el menú.
 */
/** Opciones del selector de ruta, con nombres en español tomados de labFormat.ts. */
const ROUTE_ALGORITHMS = (Object.keys(ROUTE_ALGORITHM_LABELS) as RouteAlgorithm[]).map((value) => ({
  value,
  label: ROUTE_ALGORITHM_LABELS[value],
}));

/** TRACE_ALGORITHMS arma la lista del menú de métodos de búsqueda en la trazabilidad (BFS, DFS, voraz, A*). */
/** Opciones del selector de búsqueda en la trazabilidad. */
const TRACE_ALGORITHMS = (Object.keys(TRACE_ALGORITHM_LABELS) as TraceAlgorithm[]).map((value) => ({
  value,
  label: TRACE_ALGORITHM_LABELS[value],
}));

/** BUDGET_ALGORITHMS arma la lista del menú de métodos para elegir hipótesis con presupuesto. */
/** Opciones del selector de presupuesto para elegir hipótesis. */
const BUDGET_ALGORITHMS = (Object.keys(BUDGET_ALGORITHM_LABELS) as BudgetAlgorithm[]).map(
  (value) => ({ value, label: BUDGET_ALGORITHM_LABELS[value] }),
);

/** SHIFT_OPTIONS son los tres turnos para validar: matutino, vespertino y nocturno. */
/** Define SHIFT_OPTIONS para el bloque de administracion. */
const SHIFT_OPTIONS: Array<{ value: ValidationShift; label: string }> = [
  { value: "matutino", label: "Matutino" },
  { value: "vespertino", label: "Vespertino" },
  { value: "nocturno", label: "Nocturno" },
];

/**
 * ChartSeries describe una línea o columna de una gráfica: su nombre (label), su color (color, en
 * formato hexadecimal, por ejemplo "#a855f7") y sus valores, uno por día.
 */
/** Contrato de datos ChartSeries utilizado por administracion. */
type ChartSeries = { label: string; color: string; values: number[] };

/*
 * ─── TIPO DE GRÁFICA DEL LABORATORIO (cambia aquí si el profesor pide otra) ───
 * Para cambiar una gráfica, escribe otra palabra entre comillas. Nada más:
 *   TIPO_LLAMADAS: "barras" (original, por día) o "pastel" (reparto del total del periodo)
 *   TIPO_TOKENS:   "lineas" (original, por día) o "pastel" (reparto del total del periodo)
 * Ejemplo: const TIPO_LLAMADAS = "pastel" as "barras" | "pastel";
 */
/*
 * Cómo funciona esta constante:
 * - "as" le dice a TypeScript qué palabras son válidas, para que no se escriba una mal.
 * - Dentro del componente, el código hace "si el tipo es barras, dibuja barras; si no, dibuja pastel".
 * - Si cambias el valor, la gráfica cambia sola al recargar la pantalla. No hace falta tocar otra parte.
 */
const TIPO_LLAMADAS = "barras" as "barras" | "pastel";
const TIPO_TOKENS = "lineas" as "lineas" | "pastel";

/**
 * seriesTotals convierte cada serie en una rebanada del pastel: suma todos los valores de la serie
 * (todos los días del periodo) y devuelve su nombre, su total (count) y su color.
 * Así, el pastel muestra el total del periodo, no el valor de cada día.
 */
/** Convierte cada serie en una rebanada: su total sumando todos los días del periodo. */
function seriesTotals(series: ChartSeries[]) {
  return series.map((line) => ({
    label: line.label,
    // "reduce" recorre los valores sumándolos. El 0 es el punto de partida de la suma.
    count: line.values.reduce((sum, value) => sum + value, 0),
    color: line.color,
  }));
}

/**
 * LineChart dibuja una gráfica de líneas con SVG (dibujo vectorial). Cada serie es una línea con puntos.
 *
 * Recibe:
 * - points: los días (cada uno con su fecha).
 * - series: las líneas a dibujar, con sus valores y colores.
 * - label: el título de la gráfica (también lo lee un lector de pantalla).
 *
 * Cómo calcula la posición:
 * - width y height son el tamaño del dibujo (760 × 220). padding es el margen de 28 que deja libre.
 * - maxValue es el valor más alto de todas las series (mínimo 1, para no dividir entre cero).
 * - Cada punto se coloca en x (de izquierda a derecha, según su día) y en y (más valor = más arriba).
 */
/** Componente LineChart: renderiza la vista de administracion. */
function LineChart({
  points,
  series,
  label,
}: {
  points: LabMetricPoint[];
  series: ChartSeries[];
  label: string;
}) {
  // Tamaño del dibujo y margen. Si cambias estos números, cambia el tamaño de la gráfica.
  const width = 760;
  const height = 220;
  const padding = 28;
  // El valor más alto de todas las series. "Math.max(1, ...)" evita dividir entre cero si todo es cero.
  const maxValue = Math.max(1, ...series.flatMap((line) => line.values));
  // El área útil dentro de los márgenes.
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  /**
   * coordinates convierte una lista de valores en texto de coordenadas "x,y" para el dibujo.
   * Si hay un solo día, lo pone en el lado izquierdo (x = padding).
   */
  /** Define coordinates para el bloque de administracion. */
  const coordinates = (values: number[]) =>
    values.map((value, index) => {
      // La posición horizontal reparte los días de izquierda a derecha.
      const x = padding + (values.length <= 1 ? 0 : (index / (values.length - 1)) * chartWidth);
      // La vertical: se resta del fondo, así un valor alto queda arriba.
      const y = height - padding - (value / maxValue) * chartHeight;
      return `${x},${y}`;
    });

  return (
    // "figure" agrupa la gráfica con su título ("figcaption"), para lectores de pantalla.
    <figure className="neo-inset rounded-2xl p-3">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{label}</span>
        {/* La leyenda: un puntito de color y el nombre de cada serie. */}
        <span className="flex flex-wrap gap-3">
          {series.map((line) => (
            <span key={line.label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="size-2 rounded-full" style={{ backgroundColor: line.color }} />
              {line.label}
            </span>
          ))}
        </span>
      </figcaption>
      {/* El dibujo SVG. "role=img" y "aria-label" lo describen para lectores de pantalla. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full overflow-visible"
        role="img"
        aria-label={label}
      >
        {/* Tres líneas guía horizontales: al 0 %, 50 % y 100 % del valor máximo, con su número. */}
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
        {/* Cada serie: una línea (polyline) que une sus puntos, y un círculo en cada punto. */}
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
              // "point" es el texto "x,y". Lo separamos en dos partes para usar cada número.
              const [rawX, rawY] = point.split(",");
              return (
                <circle
                  key={`${line.label}-${index}`}
                  cx={Number(rawX ?? 0)}
                  cy={Number(rawY ?? 0)}
                  r="3"
                  fill={line.color}
                  // Al pasar el mouse, el lector o el texto muestra: día, valor y nombre de la serie.
                  aria-label={`${points[index]?.day ?? ""}: ${line.values[index]} ${line.label}`}
                />
              );
            })}
          </g>
        ))}
        {/* La primera y la última fecha, abajo. "slice(5)" quita el año y deja "MM-DD". */}
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

/**
 * BarChart dibuja una gráfica de columnas con SVG. Cada día tiene un grupo de columnas, una por serie.
 *
 * Recibe: points (los días), series (las columnas por día, con sus colores) y label (el título).
 *
 * Cómo calcula el ancho:
 * - slotWidth es el espacio de cada día.
 * - groupWidth es el ancho del grupo de columnas (máximo 32 píxeles, para que no se vean gordas).
 * - barWidth reparte ese ancho entre las series, dejando un espacio (gap) entre columnas.
 */
/** Componente BarChart: renderiza la vista de administracion. */
function BarChart({
  points,
  series,
  label,
}: {
  points: LabMetricPoint[];
  series: ChartSeries[];
  label: string;
}) {
  // Tamaño del dibujo y margen.
  const width = 760;
  const height = 220;
  const padding = 28;
  // El valor más alto, para que la columna más alta llegue arriba. Mínimo 1 para no dividir entre cero.
  const maxValue = Math.max(1, ...series.flatMap((line) => line.values));
  // El área útil dentro de los márgenes.
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  // Espacio disponible para cada día. "Math.max(1, ...)" evita dividir entre cero si no hay días.
  const slotWidth = chartWidth / Math.max(1, points.length);
  // El grupo de columnas de un día: 72 % del espacio del día, con tope de 32 píxeles.
  const groupWidth = Math.min(32, slotWidth * 0.72);
  // Espacio entre columnas: 2 si hay más de una serie, 0 si hay una sola.
  const gap = series.length > 1 ? 2 : 0;
  // Ancho de cada columna dentro del grupo.
  const barWidth = (groupWidth - gap * (series.length - 1)) / Math.max(1, series.length);

  return (
    <figure className="neo-inset rounded-2xl p-3">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{label}</span>
        {/* La leyenda: un cuadrito de color y el nombre de cada serie. */}
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
        {/* Las tres líneas guía horizontales, igual que en la gráfica de líneas. */}
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
        {/* Un grupo por día. "center" es el centro del espacio del día; el grupo empieza a la izquierda de ese centro. */}
        {points.map((point, pointIndex) => {
          const center = padding + (pointIndex + 0.5) * slotWidth;
          const groupStart = center - groupWidth / 2;
          return (
            <g key={point.day}>
              {/* Una columna por serie. Su altura es proporcional a su valor; se dibuja desde el fondo hacia arriba. */}
              {series.map((item, seriesIndex) => {
                // "?? 0" usa cero si el valor no existe.
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
                    {/* El texto que aparece al pasar el mouse sobre la columna: día, serie y valor. */}
                    <title>{`${point.day}: ${item.label} ${value}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
        {/* Primera y última fecha, abajo ("MM-DD"). */}
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

/**
 * TraceResult muestra el camino encontrado por la búsqueda de trazabilidad, paso por paso.
 *
 * Recibe: result (el resultado de la búsqueda).
 *
 * Casos:
 * - Si no encontró camino (found = false): un mensaje.
 * - Si encontró camino: el método usado, cuántos elementos revisó, la comparación con BFS
 *   (si BFS dio un camino) y la lista numerada de cada nodo del camino.
 */
/** Componente TraceResult: renderiza la vista de administracion. */
function TraceResult({ result }: { result: TracePathResult }) {
  // Caso 1: no hay camino. Mostramos un mensaje y terminamos.
  /** Rama condicional: !result.found. */
  if (!result.found) {
    return (
      <p className="text-sm text-slate-400">
        No se encontró una ruta de trazabilidad hasta ese elemento.
      </p>
    );
  }
  // Caso 2: hay camino. "path.length - 1" son los pasos: un camino de 3 nodos tiene 2 pasos.
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400">
        {TRACE_ALGORITHM_LABELS[result.algorithm]} · {result.expanded_count} elementos revisados
      </p>
      {/* Comparación con la referencia BFS. Solo aparece si BFS dio un camino (no es null). */}
      {result.shortest_path_steps !== null && (
        <p className="text-xs text-slate-400">
          Camino más corto (referencia BFS): {result.shortest_path_steps} pasos. Este camino tiene{" "}
          {result.path.length - 1} pasos.
          {/* Si los pasos son iguales, "coinciden"; si no, la pista no encontró el mejor camino. */}
          {result.path.length - 1 === result.shortest_path_steps
            ? " Coinciden."
            : " No coinciden: la pista no encontró el camino más corto."}
        </p>
      )}
      {/* La lista numerada del camino: un círculo con el número, el tipo del nodo y su texto. */}
      <ol className="flex flex-col gap-2">
        {result.path.map((node, index) => (
          <li key={node.id} className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-violet/20 text-xs font-bold text-accent-violet">
              {index + 1}
            </span>
            <div className="neo-inset min-w-0 flex-1 rounded-xl p-3">
              {/* El tipo del nodo (por ejemplo "finding" o "source"), en letras pequeñas. */}
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

/**
 * TraceOverview muestra, plegado, el listado de relaciones reales del proyecto (el grafo).
 *
 * Recibe: graph (el grafo del proyecto).
 *
 * Muestra hasta 100 relaciones. Cada una dice: "de dónde" — "relación" → "a dónde".
 * Si el servidor recortó el grafo por tamaño (truncated), avisa al principio.
 */
/** Componente TraceOverview: renderiza la vista de administracion. */
function TraceOverview({ graph }: { graph: ProjectTraceGraph }) {
  return (
    // "details" permite plegar la lista. El resumen muestra cuántos nodos y vínculos hay.
    <details className="neo-inset rounded-xl p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">
        Relaciones reales del proyecto ({graph.nodes.length} nodos · {graph.edges.length} vínculos)
      </summary>
      {/* Aviso si el grafo se recortó por tamaño. */}
      {graph.truncated && (
        <p className="mt-2 text-xs text-amber-200">
          El grafo se limitó para mantener la respuesta ligera; se muestran las relaciones más
          recientes.
        </p>
      )}
      {/* Solo las primeras 100 relaciones, para no saturar la pantalla. */}
      <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto">
        {graph.edges.slice(0, 100).map((edge, index) => {
          // Buscamos el texto de cada extremo a partir de su id. Si no lo encuentra, muestra el id.
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

/**
 * ProjectPicker es el menú para elegir el proyecto con el que se trabaja. Cada opción muestra
 * título, propietario y estado.
 */
/** Componente ProjectPicker: renderiza la vista de administracion. */
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

/**
 * PlaceSelection muestra la lista de lugares encontrados con casillas para elegirlos.
 * Permite elegir hasta 8 lugares; al llegar a 8, las casillas no marcadas se bloquean.
 *
 * Recibe:
 * - places: los lugares encontrados.
 * - selectedIds: los ids de los lugares ya elegidos.
 * - onToggle: qué hacer al marcar o desmarcar uno.
 */
/** Componente PlaceSelection: renderiza la vista de administracion. */
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
          // El id del lugar se arma igual que en el servidor: "tipo:numero" (por ejemplo "node:12345").
          const id = `${place.osm_type}:${place.osm_id}`;
          // ¿Ya está elegido?
          const checked = selectedIds.includes(id);
          return (
            <li key={id}>
              <label className="neo-inset flex cursor-pointer items-start gap-2 rounded-xl p-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  // Se bloquea si ya hay 8 elegidos y esta casilla no está marcada.
                  disabled={!checked && selectedIds.length >= 8}
                  onChange={() => onToggle(id)}
                  className="mt-1 accent-violet-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-100">{place.name}</span>
                  {/* La categoría (o subtipo) y las coordenadas con 4 decimales. */}
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

/**
 * ProjectRouteResult muestra el resultado de la ruta: el método, el recorrido total, la mejor ruta
 * posible (referencia exacta), la lista de paradas con la distancia desde la anterior, y la nota
 * sobre cómo se midió.
 *
 * Recibe: result (el resultado de la ruta).
 */
/** Componente ProjectRouteResult: renderiza la vista de administracion. */
function ProjectRouteResult({ result }: { result: LabRouteResult }) {
  return (
    <div className="neo-inset flex flex-col gap-2 rounded-xl p-3">
      {/* Las tres etiquetas de arriba: método, recorrido total y la mejor ruta posible. */}
      <div className="flex flex-wrap gap-2">
        <Badge>{ROUTE_ALGORITHM_LABELS[result.algorithm]}</Badge>
        <Badge>Recorrido total: {formatDistance(result.total_distance_km)}</Badge>
        <Badge>Mejor ruta posible: {formatDistance(result.optimal_reference_km)}</Badge>
      </div>
      {/* Las paradas en orden. */}
      <ol className="flex flex-col gap-1 text-sm text-slate-200">
        {result.stops.map((stop, index) => (
          <li key={`${stop.osm_type}-${stop.osm_id}`}>
            {index + 1}. {stop.name} · {formatDistance(stop.distance_from_previous_km)} desde la
            parada anterior
          </li>
        ))}
      </ol>
      {/* La nota de cómo se midió la distancia y cuánto cuesta regresar al punto de partida. */}
      <p className="text-xs text-slate-500">
        {result.distance_note} Regreso al punto de partida: {formatDistance(result.return_distance_km)}.
      </p>
    </div>
  );
}

/**
 * PaletteGroup dibuja un grupo de colores de muestra: una franja de cuadritos con su título.
 * El color aparece también como texto al pasar el mouse (title) y como nombre para lectores de pantalla.
 *
 * Recibe:
 * - title: el nombre del grupo (por ejemplo "Categórica").
 * - colors: la lista de colores en formato hexadecimal.
 */
/** Componente PaletteGroup: renderiza la vista de administracion. */
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

/**
 * AdminLabPage es el componente principal. Guarda todo lo que la persona elige (proyecto, método,
 * zona, lugares, algoritmo de ruta, etc.), pide datos al servidor y arma la pantalla completa.
 *
 * Flujo típico:
 * 1. Se carga la lista de proyectos y se elige el primero.
 * 2. Al elegir un proyecto, se carga su grafo (trazabilidad) y se activan las demás secciones.
 * 3. Para una ruta: elegir zona, buscar lugares, marcar 2 a 8 lugares y pulsar "Optimizar visita".
 *
 * Cada vez que cambia el proyecto, se limpian las búsquedas anteriores para no mezclar resultados.
 */
/** Expone la funcion admin lab page para el flujo de admin. */
export function AdminLabPage() {
  // Cambia el título de la pestaña del navegador.
  useDocumentTitle("Laboratorio de algoritmos");
  // Las peticiones al servidor. Las "mutation" son acciones que piden un cálculo.
  const projectList = useAdminLabProjects();
  // Métricas de los últimos 30 días (las gráficas de actividad).
  const metrics = useAdminLabMetrics(30);
  // Buscar una zona por nombre (geocodificación: convertir un nombre en coordenadas).
  const geocode = useGeocode();
  const tracePath = useSearchProjectTrace();
  const placeSearch = useSearchProjectPlaces();
  const routeOptimization = useOptimizeProjectRoute();

  // Lo que la persona elige o escribe. Cada uno tiene su valor inicial a la derecha.
  // Proyecto elegido ("" significa que todavía no hay ninguno).
  const [projectId, setProjectId] = useState("");
  // Método y destino de la búsqueda de trazabilidad.
  const [traceAlgorithm, setTraceAlgorithm] = useState<TraceAlgorithm>("bfs");
  const [traceTarget, setTraceTarget] = useState("");
  // La zona: texto escrito, último texto buscado, resultados de la búsqueda y el centro elegido.
  const [locationQuery, setLocationQuery] = useState("");
  const [lastGeocodeQuery, setLastGeocodeQuery] = useState("");
  const [locationMatches, setLocationMatches] = useState<GeoPlace[]>([]);
  const [center, setCenter] = useState<GeoPlace | null>(null);
  // Giro o palabra clave de los negocios a buscar, y el radio en metros.
  const [keyword, setKeyword] = useState("");
  const [radius, setRadius] = useState(1000);
  // Los lugares marcados para la ruta (máximo 8).
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  // Método de ruta (por defecto, búsqueda local por intercambio) y los tres parámetros del genético.
  // Los valores 42, 24 y 30 son los mismos que tiene el servidor por defecto.
  const [routeAlgorithm, setRouteAlgorithm] = useState<RouteAlgorithm>("hill_climbing");
  const [routeSeed, setRouteSeed] = useState(42);
  const [routePopulation, setRoutePopulation] = useState(24);
  const [routeGenerations, setRouteGenerations] = useState(30);

  // Los proyectos disponibles. "?? []" usa lista vacía mientras todavía carga.
  const projects = projectList.data?.projects ?? [];
  // El proyecto que está elegido, con sus datos completos (o undefined si no hay).
  const selectedProject = projects.find((project) => project.id === projectId);
  // El grafo del proyecto elegido. "projectId || null" usa null si no hay proyecto, y así no pide nada.
  const trace = useAdminProjectTrace(projectId || null);
  const traceGraph = trace.data;
  // Las hipótesis del grafo. "useMemo" guarda la lista y solo la vuelve a calcular si cambia el grafo.
  const hypothesisNodes = useMemo(
    () => (traceGraph?.nodes ?? []).filter((node) => node.kind === "hypothesis"),
    [traceGraph],
  );
  // Los destinos posibles de la búsqueda: todos los nodos menos la raíz y el proyecto mismo.
  const traceTargets = useMemo(
    () =>
      (traceGraph?.nodes ?? []).filter(
        (node) => node.id !== traceGraph?.root_id && node.kind !== "project",
      ),
    [traceGraph],
  );
  // Los lugares encontrados en la última búsqueda de lugares.
  const geoPlaces = placeSearch.data?.places ?? [];

  // Si todavía no hay proyecto elegido y ya llegó la lista, elegimos el primero.
  useEffect(() => {
    /** Rama condicional: !projectId && projects.length > 0. */
    // "!" en projects[0]! le dice a TypeScript que sí existe (ya revisamos que la lista no está vacía).
    if (!projectId && projects.length > 0) setProjectId(projects[0]!.id);
  }, [projectId, projects]);

  // Si el destino elegido ya no existe en el grafo, elegimos el primero de la lista.
  useEffect(() => {
    /** Rama condicional: traceTargets.length > 0 && !traceTargets.some((node) =>. */
    if (traceTargets.length > 0 && !traceTargets.some((node) => node.id === traceTarget)) {
      setTraceTarget(traceTargets[0]!.id);
    }
  }, [traceTarget, traceTargets]);

  // Las series de la gráfica de llamadas: "Llamadas" (morado) y "Errores" (rojo), por día.
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
  // Las series de la gráfica de tokens: "Entrada" (cian) y "Salida" (lila), por día.
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

  /**
   * selectProject cambia de proyecto. Limpia TODO lo que dependía del proyecto anterior (zona, lugares,
   * resultados) para que no se mezclen datos de dos proyectos.
   */
  /** Selecciona select project de administracion. */
  function selectProject(nextId: string) {
    setProjectId(nextId);
    setTraceTarget("");
    setCenter(null);
    setLocationQuery("");
    setLastGeocodeQuery("");
    setLocationMatches([]);
    setSelectedPlaceIds([]);
    // "reset" borra el resultado y el error de cada búsqueda.
    tracePath.reset();
    placeSearch.reset();
    routeOptimization.reset();
  }

  /**
   * geocodeProjectZone busca la zona escrita por nombre. Si hay un solo resultado, lo elige como centro
   * de inmediato. Si hay varios, los muestra para que la persona escoja.
   */
  /** Gestiona geocode project zone de administracion. */
  async function geocodeProjectZone(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    // Texto sin espacios de los extremos.
    const query = locationQuery.trim();
    // No busca si está vacío o si ya hay una búsqueda en curso.
    /** Rama condicional: !query || geocode.isPending. */
    if (!query || geocode.isPending) return;
    setLastGeocodeQuery(query);
    setLocationMatches([]);
    /** Maneja fallos de la operacion del bloque administracion. */
    try {
      const results = await geocode.mutateAsync(query);
      setLocationMatches(results);
      // Si solo hay un resultado, no hace falta elegir: se usa directamente.
      /** Rama condicional: results.length === 1. */
      if (results.length === 1) setCenter(results[0]!);
    } catch {
      setLocationMatches([]);
    }
  }

  /**
   * pickMapCenter se ejecuta cuando la persona toca un punto del mapa. Crea un "centro" con esas
   * coordenadas y limpia los resultados anteriores (los lugares de la búsqueda anterior ya no aplican).
   * El identificador empieza con "project-lab:" para distinguirlo de los lugares reales de OSM.
   */
  /** Gestiona pick map center de administracion. */
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

  /**
   * searchProjectPlaces busca negocios cerca del centro, con el giro y el radio elegidos.
   * No busca si falta el proyecto, el centro o si el giro tiene menos de 2 letras.
   */
  /** Gestiona search project places de administracion. */
  function searchProjectPlaces(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    /** Rama condicional: !projectId || !center || keyword.trim().length < 2. */
    if (!projectId || !center || keyword.trim().length < 2) return;
    // Los lugares elegidos de la búsqueda anterior ya no sirven: se limpian.
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

  /**
   * submitRoute pide calcular la ruta entre los lugares marcados. Necesita al menos 2 lugares.
   * Manda también la semilla y los dos parámetros del genético (aunque solo se usan si eligió "Algoritmo genético").
   */
  /** Gestiona submit route de administracion. */
  function submitRoute(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    /** Rama condicional: !projectId || !center || selectedPlaceIds.length < 2. */
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

  /** submitTracePath pide buscar el camino desde la raíz del proyecto hasta el destino elegido, con el método elegido. */
  /** Gestiona submit trace path de administracion. */
  function submitTracePath(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    /** Rama condicional: !projectId || !traceTarget. */
    if (!projectId || !traceTarget) return;
    tracePath.mutate({ projectId, algorithm: traceAlgorithm, targetNodeId: traceTarget });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* El encabezado: título, explicación y botones para ir a las proposiciones o a Administración. */}
      <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
        <PageHeader
          eyebrow="Laboratorio de algoritmos · para entender cómo se buscan y comparan opciones"
          title="Laboratorio de algoritmos"
          description="Aquí ves, con datos reales de un proyecto, cómo funcionan distintos algoritmos: búsquedas, rutas y presupuesto. Los resultados son sugerencias temporales y no cambian los datos guardados."
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

      {/* La guía: una tarjeta por método, con su familia, su idea y su garantía. Los textos vienen de labFormat.ts. */}
      <GlassPanel className="flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
        <header>
          <h2 className="font-display text-lg font-bold">¿Qué es este laboratorio?</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            Cada algoritmo busca una respuesta de forma distinta. Algunos revisan todo, otros usan
            una pista para ir más rápido y otros mejoran una respuesta paso a paso. Lee la
            garantía de cada uno: indica si asegura la mejor respuesta o solo una buena.
          </p>
        </header>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {ALGORITHM_GUIDE.map((item) => (
            <article key={item.name} className="neo-inset flex flex-col gap-2 rounded-2xl p-4">
              <p className="text-[10px] font-semibold tracking-wider text-accent-cyan uppercase">
                {item.family}
              </p>
              <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
              <p className="text-xs leading-relaxed text-slate-300">{item.idea}</p>
              <p className="text-xs leading-relaxed text-slate-400">
                <strong className="text-slate-200">Garantía:</strong> {item.guarantee}
              </p>
            </article>
          ))}
        </div>
      </GlassPanel>

      {/* La elección del proyecto. Muestra un aviso mientras carga, un error, o el menú con el resumen del elegido. */}
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
            {/* El resumen del proyecto elegido: título, estado, propietario y alcance geográfico (si existe). */}
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
        {/* Mientras el grafo se construye, un aviso. Si falla, el error. */}
        {trace.isFetching && (
          <p role="status" className="flex items-center gap-2 text-xs text-slate-400">
            <Spinner className="size-4 text-accent-cyan" /> Construyendo el grafo real del proyecto…
          </p>
        )}
        {trace.isError && <Alert>{errorMessageFrom(trace.error)}</Alert>}
      </GlassPanel>

      {/* Las dos gráficas de actividad. Cada una puede ser de barras/líneas o de pastel, según TIPO_LLAMADAS y TIPO_TOKENS. */}
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
            {/* Primera gráfica: barras por día (original) o pastel del total del periodo, según TIPO_LLAMADAS. */}
            {TIPO_LLAMADAS === "barras" ? (
              <GlassPanel className="rounded-3xl p-4">
                <BarChart
                  points={metrics.data.points}
                  series={metricsSeries}
                  label="Llamadas y errores de IA por día"
                />
              </GlassPanel>
            ) : (
              <PieChart
                id="admin-calls-pie"
                title="Llamadas y errores de IA"
                explanation="Reparto del total del periodo entre llamadas y errores."
                entries={seriesTotals(metricsSeries)}
                icon={FiPieChart}
              />
            )}
            {/* Segunda gráfica: líneas por día (original) o pastel del total del periodo, según TIPO_TOKENS. */}
            {TIPO_TOKENS === "lineas" ? (
              <GlassPanel className="rounded-3xl p-4">
                <LineChart
                  points={metrics.data.points}
                  series={tokenSeries}
                  label="Tokens de entrada y salida por día"
                />
              </GlassPanel>
            ) : (
              <PieChart
                id="admin-tokens-pie"
                title="Tokens de entrada y salida"
                explanation="Reparto del total de tokens del periodo entre lo que se envió y lo que se recibió."
                entries={seriesTotals(tokenSeries)}
                icon={FiPieChart}
              />
            )}
          </div>
        )}
      </section>

      {/* Todo lo que depende del proyecto elegido. Solo se muestra si ya llegó el grafo. */}
      {projectId && traceGraph && (
        <>
          <div className="grid min-w-0 gap-6 2xl:grid-cols-2">
            {/* La trazabilidad: formulario de búsqueda, resultado y las relaciones del proyecto. */}
            <GlassPanel className="flex min-w-0 flex-col gap-4 rounded-3xl p-5 sm:p-6">
              <header>
                <h2 className="font-display text-lg font-bold">Trazabilidad del proyecto</h2>
                <p className="text-xs leading-relaxed text-slate-400">
                  Busca cómo llegar desde la idea hasta un elemento del proyecto siguiendo sus
                  vínculos (atributos, fuentes, evidencias, hallazgos y análisis). Las búsquedas
                  ciegas (BFS y DFS) no usan pistas. Las de heurística (voraz y A*) usan la
                  diferencia de nivel entre cada elemento y el objetivo para revisar primero lo
                  más prometedor. BFS sirve como referencia del camino más corto.
                </p>
              </header>
              <form
                onSubmit={submitTracePath}
                className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] 2xl:items-end"
              >
                <Select
                  label="Método de búsqueda"
                  value={traceAlgorithm}
                  options={TRACE_ALGORITHMS}
                  onChange={(value) => setTraceAlgorithm(value as TraceAlgorithm)}
                />
                {/* El destino: cada opción muestra el tipo del nodo y su texto (cortado a 48 letras). */}
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

            {/* El entorno geográfico: buscar la zona, elegir el centro en el mapa, buscar lugares, marcarlos y ordenar la visita. */}
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
              {/* La búsqueda de la zona por nombre. El placeholder usa la zona confirmada del proyecto, si la hay. */}
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
                {/* El botón se activa con al menos 3 letras. */}
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
              {/* Aviso si la búsqueda ya terminó y no hubo ningún resultado. */}
              {!geocode.isPending &&
                lastGeocodeQuery === locationQuery.trim() &&
                geocode.isSuccess &&
                locationMatches.length === 0 &&
                geocode.data?.length === 0 && (
                  <p className="text-xs text-slate-400">No se encontraron zonas con ese nombre.</p>
                )}
              {/* Si hay varias zonas con ese nombre, una lista para elegir una. Al elegir, se usa como centro. */}
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
              {/* El mapa: muestra el centro, los lugares y el radio. Al tocar el mapa, cambia el centro. */}
              <GeoMap
                center={center}
                places={geoPlaces}
                radiusM={radius}
                onSelectLocation={pickMapCenter}
              />
              {/* El formulario para buscar negocios: palabra clave, radio y botón. */}
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
                {/* Se activa con un centro elegido y un giro de al menos 2 letras. */}
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
                  // Al tocar un lugar: si ya estaba, lo quita; si no, lo agrega (solo si hay menos de 8).
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
              {/* El formulario de la ruta: aparece después de buscar lugares. Con "genético", muestra también semilla, población y generaciones. */}
              {placeSearch.data && (
                <form
                  onSubmit={submitRoute}
                  className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                >
                  <Select
                    label="Método para ordenar la visita"
                    value={routeAlgorithm}
                    options={ROUTE_ALGORITHMS}
                    onChange={(value) => setRouteAlgorithm(value as RouteAlgorithm)}
                  />
                  {/* Se activa con 2 o más lugares marcados. */}
                  <Button
                    type="submit"
                    size="sm"
                    loading={routeOptimization.isPending}
                    disabled={selectedPlaceIds.length < 2}
                  >
                    Optimizar visita
                  </Button>
                  {/* Solo para el método genético: semilla (0 a 2147483647), población (4 a 60) y generaciones (1 a 80). */}
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

          {/* Las dos herramientas de planeación: presupuesto y turnos. */}
          <div className="grid gap-6 2xl:grid-cols-2">
            {/* "key" con el id del proyecto: si cambia el proyecto, el panel se reinicia y no conserva lo anterior. */}
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

      {/* Si no hay proyectos, una sugerencia para crear uno. */}
      {!projectId && !projectList.isPending && projects.length === 0 && (
        <GlassPanel className="rounded-3xl p-6 text-sm text-slate-400">
          Crea un proyecto para explorar trazabilidad, hipótesis y lugares relacionados.
        </GlassPanel>
      )}

      {/* Las paletas de colores de muestra. Son colores fijos del diseño, no datos del proyecto. */}
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

/**
 * HypothesisBudgetPanel permite elegir hipótesis del proyecto con un presupuesto. La persona marca
 * las hipótesis, escribe el costo y el valor esperado de cada una (estimaciones suyas), y el servidor
 * recomienda qué conviene validar sin pasarse del presupuesto.
 *
 * Recibe:
 * - projectId: el proyecto.
 * - hypotheses: los nodos de tipo hipótesis del grafo.
 *
 * Reglas: máximo 16 hipótesis; costo de 0 a 1,000,000; valor de 0 a 100; presupuesto hasta 10,000,000.
 */
/** Componente HypothesisBudgetPanel: renderiza la vista de administracion. */
function HypothesisBudgetPanel({
  projectId,
  hypotheses,
}: {
  projectId: string;
  hypotheses: TraceGraphNode[];
}) {
  // La acción de calcular la recomendación.
  const budgetPlan = usePlanHypothesisBudget();
  // Presupuesto disponible (por defecto 10,000), método (por defecto búsqueda local) y hipótesis marcadas.
  const [budget, setBudget] = useState(10000);
  const [budgetAlgorithm, setBudgetAlgorithm] = useState<BudgetAlgorithm>("hill_climbing");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Las estimaciones de costo y valor de cada hipótesis, guardadas por su id de nodo.
  const [estimates, setEstimates] = useState<Record<string, { cost: number; value: number }>>({});

  /**
   * submit arma la lista de hipótesis marcadas con su costo y valor, y la envía al servidor.
   * "slice('hypothesis:'.length)" quita el prefijo "hypothesis:" del id del nodo para dejar solo el
   * id real de la hipótesis. Si una estimación falta, se manda 0.
   */
  /** Gestiona submit de administracion. */
  function submit(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    budgetPlan.mutate({
      projectId,
      data: {
        budget,
        algorithm: budgetAlgorithm,
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
      {/* Si el proyecto no tiene hipótesis, un aviso. Si tiene, el formulario. */}
      {hypotheses.length === 0 ? (
        <p className="text-sm text-slate-400">Este proyecto aún no tiene hipótesis de validación.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Select
            label="Método para elegir hipótesis"
            value={budgetAlgorithm}
            options={BUDGET_ALGORITHMS}
            onChange={(value) => setBudgetAlgorithm(value as BudgetAlgorithm)}
          />
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
          {/* La lista de hipótesis. Cada una tiene su casilla; si está marcada, aparecen sus dos campos de estimación. */}
          <div className="flex max-h-72 flex-col gap-2 overflow-auto">
            {hypotheses.map((node) => {
              // ¿Está marcada? y su estimación actual (si no tiene, 0 y 0).
              const selected = selectedIds.includes(node.id);
              const estimate = estimates[node.id] ?? { cost: 0, value: 0 };
              return (
                <div key={node.id} className="neo-inset rounded-xl p-3">
                  <label className="flex items-start gap-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={selected}
                      // Al marcar, la agrega (si hay menos de 16). Al desmarcar, la quita.
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
                  {/* Los campos de costo y valor solo aparecen si la hipótesis está marcada. */}
                  {selected && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        aria-label={`Costo estimado: ${node.label}`}
                        placeholder="Costo"
                        value={estimate.cost}
                        // Al escribir, guarda el nuevo costo sin tocar el valor.
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
                        // Al escribir, guarda el nuevo valor sin tocar el costo.
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
          {/* Se activa solo si hay al menos una hipótesis marcada. */}
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
      {/* El resultado: el valor total, el costo usado frente al presupuesto, y la lista de hipótesis recomendadas. */}
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

/**
 * ValidationSchedulePanel reparte las hipótesis elegidas en tres turnos (matutino, vespertino y nocturno).
 * Cada hipótesis tiene un turno preferido, y el servidor intenta respetarlo. La capacidad por turno
 * limita cuántas tareas caben en cada turno.
 *
 * Recibe:
 * - projectId: el proyecto.
 * - hypotheses: los nodos de tipo hipótesis del grafo.
 *
 * Regla: el total de hipótesis elegidas no puede pasar de capacidad × 3 (tres turnos).
 */
/** Componente ValidationSchedulePanel: renderiza la vista de administracion. */
function ValidationSchedulePanel({
  projectId,
  hypotheses,
}: {
  projectId: string;
  hypotheses: TraceGraphNode[];
}) {
  // La acción de organizar el plan.
  const validationSchedule = useScheduleProjectValidation();
  // Capacidad por turno (por defecto 4), hipótesis marcadas y turno preferido de cada una.
  const [capacity, setCapacity] = useState(4);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Record<string, ValidationShift>>({});

  /**
   * submit arma la lista de tareas (cada hipótesis con su turno preferido) y la envía.
   * Si una hipótesis no tiene turno elegido, se usa "matutino". Igual que en el presupuesto,
   * "slice('hypothesis:'.length)" quita el prefijo del id.
   */
  /** Gestiona submit de administracion. */
  function submit(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
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
      {/* Si no hay hipótesis, un aviso. Si hay, el formulario. */}
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
          {/* La lista de hipótesis. Al marcar una, aparece su menú de turno preferido. */}
          <div className="flex max-h-72 flex-col gap-2 overflow-auto">
            {hypotheses.map((node) => {
              const selected = selectedIds.includes(node.id);
              return (
                <div key={node.id} className="neo-inset rounded-xl p-3">
                  <label className="flex items-start gap-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={selected}
                      // Igual que en el presupuesto: agrega (hasta 16) o quita.
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
                      // Al elegir turno, guarda la preferencia de esta hipótesis.
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
          {/* Se bloquea si no hay hipótesis, o si hay más que lo que caben en los tres turnos. */}
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
      {/* El resultado: cada tarea con su turno preferido y el turno asignado, y el resumen al final. */}
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
          {/* El resumen: cuántas preferencias se respetaron y el puntaje. Aclara que es temporal y no se guarda. */}
          <li className="border-t border-white/10 pt-2 text-xs text-slate-400">
            Preferencias satisfechas: {validationSchedule.data.satisfied_preferences} · puntaje{" "}
            {validationSchedule.data.priority_weighted_score} · temporal, no guardado
          </li>
        </ol>
      )}
    </GlassPanel>
  );
}
