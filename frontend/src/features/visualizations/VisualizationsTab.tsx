/**
 * ARCHIVO: visualizations/VisualizationsTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Visualizaciones del proyecto". Resume con gráficas lo que hay en el proyecto:
 * qué temas aparecen en la investigación, cómo van las revisiones de resultados, cuántas
 * alternativas hay, de qué tipo de sitios vienen las fuentes y cuándo se consultaron.
 *
 * ¿Para qué sirve?
 * Para ver de un vistazo el estado de la investigación sin leer cada tarjeta. Las gráficas
 * resumen los datos que ya existen; no crean ni cambian nada del proyecto.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "visualizaciones").
 *
 * Gráficas que muestra, en orden:
 * 1. Temas que aparecen (barras por categoría de investigación).
 * 2. Revisión de resultados (dona: aceptados, sin revisar y rechazados).
 * 3. Alternativas encontradas (barras por tipo de competidor, sin contar los rechazados).
 * 4. De dónde viene la información (barras por tipo de fuente).
 * 5. Fuentes consultadas con el tiempo (línea de los últimos 6 meses).
 *
 * Cómo cambiar el tipo de una gráfica: busca los valores TIPO_* más abajo en este archivo
 * (cerca del bloque "TIPO DE CADA GRÁFICA"). Escribe otra palabra entre comillas.
 *
 * Archivos que usa:
 * - components/ui/PieChart.tsx: el dibujo de pastel y dona.
 * - findings, research: los datos de resultados, competidores y fuentes (con sus queries).
 */

/* El tipo de un icono de react-icons. Sirve para decir que un icono es válido para una tarjeta. */
import type { IconType } from "react-icons";
/* Los iconos de cada tarjeta: gráfica de barras, libro, pastel, recargar, tendencia y grupo de personas. */
import { FiBarChart2, FiBookOpen, FiPieChart, FiRefreshCw, FiTrendingUp, FiUsers } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
/* Convierte errores a texto. */
import { errorMessageFrom } from "../../lib/formErrors";
/* Mensaje de "todavía no hay nada". */
import { EmptyState } from "../projects/components/EmptyState";
/* El proyecto que entregó el detalle a esta pestaña. */
import { useProjectOutlet } from "../projects/outlet";
/* Textos de competidores y de revisión (carpeta de resultados). */
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, REVIEW_LABELS } from "../findings/constants";
/* Consultas de resultados y competidores, desde la caché. */
import { useCompetitors, useFindings } from "../findings/queries";
/* Tipos de competidor y de revisión. */
import type { CompetitorType, ReviewStatus } from "../findings/types";
/* Nombres de temas y tipos de fuente, y la consulta de fuentes (carpeta de investigación). */
import { CATEGORY_LABELS, SOURCE_TYPE_LABELS } from "../research/constants";
/* El dibujo de pastel y dona, reutilizable en otras pantallas. */
import { PieChart } from "../../components/ui/PieChart";
import { useSources } from "../research/queries";
/* Tipos de categoría, fuente y tipo de fuente. */
import type { ResearchCategory, Source, SourceType } from "../research/types";

/**
 * CATEGORY_COLORS son las clases de color (de Tailwind) de las barras de "Temas que aparecen".
 * Cada barra toma un color según su posición: la primera cian, la segunda verde, etc. Si hay más
 * barras que colores, se repite desde el principio (índice % largo de la lista).
 *
 * Importante: son nombres de clase (como "bg-cyan-400"), no códigos de color. Por eso no sirven
 * para el dibujo SVG del pastel; para eso se usan colores en formato "#rrggbb".
 */
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

/**
 * REVIEW_COLORS son los colores en formato hexadecimal de cada estado de revisión:
 * aceptado (verde), sin revisar (ámbar) y rechazado (rosa). La dona los usa para pintar sus rebanadas.
 */
/** Configuracion visual de REVIEW_COLORS para ubicar colores/animaciones de graficas. */
const REVIEW_COLORS: Record<ReviewStatus, string> = {
  accepted: "#34d399",
  proposed: "#fbbf24",
  rejected: "#fb7185",
};

/**
 * REVIEW_ORDER es el orden de los estados en la dona y en su leyenda: aceptados, sin revisar y rechazados.
 */
/** Catalogo REVIEW_ORDER que define etiquetas o reglas de graficas. */
const REVIEW_ORDER: ReviewStatus[] = ["accepted", "proposed", "rejected"];
/**
 * COMPETITOR_COLORS son las clases de color de las barras de "Alternativas encontradas", en el orden
 * de COMPETITOR_TYPES (muy parecida, otra forma, reemplazo y alternativa).
 */
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
/*
 * Cómo funciona este bloque:
 * - "type" crea un nombre para un conjunto de palabras válidas. TipoGrafica acepta solo
 *   "barras", "pastel" o "dona". Si escribes otra palabra, TypeScript te avisa al compilar.
 * - Cada constante TIPO_* guarda una de esas palabras. CountChart (más abajo) lee el valor y decide
 *   qué dibujo mostrar.
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

/**
 * CountBarEntry es un renglón de la gráfica de barras: su nombre (label), cuántos hay (count)
 * y, opcionalmente, su color. Si no tiene color, toma uno de CATEGORY_COLORS.
 */
/** Contrato de datos CountBarEntry utilizado por graficas. */
interface CountBarEntry {
  label: string;
  count: number;
  color?: string;
}

/**
 * CountBarChart dibuja una tarjeta con barras horizontales. Cada renglón tiene un nombre, una barra
 * que crece según su cantidad, y el número.
 *
 * Recibe:
 * - id: un identificador para el título (lo usan los lectores de pantalla).
 * - title y explanation: el título y la frase explicativa de la tarjeta.
 * - entries: los renglones a dibujar.
 * - icon: el icono de la esquina.
 *
 * Cálculo del ancho: la barra más grande ocupa el 100 %. Las demás se calculan con regla de tres
 * (cantidad / máximo). Si la cantidad es 0, la barra no aparece; si es mayor a 0, nunca mide menos de 5 %,
 * para que se vea un poco aunque sea muy pequeña.
 */
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
  // El valor más alto de la lista. "Math.max(1, ...)" evita dividir entre cero si todo es 0.
  const maxCount = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    // La tarjeta. "region" con "aria-labelledby" la identifica por su título para lectores de pantalla.
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
            // Cada renglón: nombre (a la izquierda), barra (al centro) y número (a la derecha).
            <li key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-xs">
              <span className="truncate text-slate-300">{label}</span>
              <span className="neo-inset h-2 overflow-hidden rounded-full">
                {/* La barra. Su color es el de la entrada, o el de la lista si no tiene uno. "duration-500" anima su crecimiento. */}
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

/**
 * ReviewStatusChart dibuja la dona de "Revisión de resultados" con SVG. Muestra un anillo que se
 * divide en tres partes (aceptados, sin revisar y rechazados), con el total en el centro y una leyenda al lado.
 *
 * Recibe: counts, la cantidad de resultados en cada estado.
 *
 * Cómo se dibuja: cada parte es un círculo con una línea gruesa (strokeWidth) y un "dasharray" que
 * indica cuánto del anillo ocupa. El "strokeDashoffset" mueve el inicio de cada parte donde terminó la anterior.
 * El SVG está girado -90° para que la primera parte empiece arriba.
 */
/** Componente ReviewStatusChart: renderiza la vista de graficas. */
function ReviewStatusChart({ counts }: { counts: Record<ReviewStatus, number> }) {
  // El total de resultados (suma de los tres estados).
  const total = REVIEW_ORDER.reduce((sum, status) => sum + counts[status], 0);
  // El radio del anillo y su longitud total (2 × π × radio), que equivale al 100 %.
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // SVG consume los segmentos como arcos continuos: cada offset inicia donde terminó el anterior.
  let offset = 0;

  return (
    // La tarjeta, como las demás gráficas, con su título identificado para lectores de pantalla.
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
          {/* El dibujo. "aria-label" describe las cantidades para lectores de pantalla. "-rotate-90" lo gira para empezar arriba. */}
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Distribución de revisión: ${REVIEW_ORDER.map((status) => `${REVIEW_LABELS[status]} ${counts[status]}`).join(", ")}`}
            className="size-full -rotate-90"
          >
            {/* El anillo de fondo, gris y muy transparente, que se ve cuando no hay datos. */}
            <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-400/15" />
            {/* Las partes de color. Solo se dibujan si hay al menos un resultado. */}
            {total > 0 &&
              REVIEW_ORDER.map((status) => {
                // Cuánto del anillo ocupa este estado: su parte del total, en la misma unidad que la circunferencia.
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
                    // El primer número es el largo de la parte; el segundo, el espacio que queda hasta el resto del anillo.
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    // Mueve la parte para que empiece donde terminó la anterior. Por eso se resta.
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                  />
                );
                // Avanzamos el inicio para la siguiente parte.
                offset += segment;
                return circle;
              })}
          </svg>
          {/* El número total en el centro del anillo. "pointer-events-none" evita que estorbe los clics. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold">{total}</span>
            <span className="text-[10px] text-slate-400">resultados</span>
          </div>
        </div>
        {/* La leyenda: un punto de color, el nombre del estado y la cantidad. */}
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

/**
 * sourcesByMonth cuenta cuántas fuentes se consultaron en cada uno de los últimos 6 meses.
 *
 * Pasos:
 * 1. Convierte cada fecha de creación en una fecha válida (descarta las que no se entienden).
 * 2. Busca el mes más reciente y toma los 6 meses que terminan en él.
 * 3. Cuenta las fuentes de cada mes, usando el mes en UTC para que no cambie según la zona horaria.
 * 4. Devuelve siempre 6 meses, aunque algunos tengan 0.
 *
 * Las fuentes más viejas de esos 6 meses no se cuentan. Si no hay ninguna fecha válida, devuelve una lista vacía.
 */
/** Gestiona sources by month de graficas. */
function sourcesByMonth(sources: Source[]) {
  // Agrupa por meses UTC para que el gráfico no cambie según la zona horaria del navegador.
  // "map" convierte cada fuente en fecha; "filter" quita las que no son fechas válidas.
  const dates = sources
    .map((source) => new Date(source.created_at))
    .filter((date) => Number.isFinite(date.getTime()));
  // Si no hay ninguna fecha válida, no hay nada que contar.
  /** Rama condicional: dates.length === 0. */
  if (dates.length === 0) return [];

  // El mes más reciente. "reduce" recorre las fechas y se queda con la más nueva.
  const latest = dates.reduce((newest, date) => (date > newest ? date : newest));
  // Un número de mes "absoluto": año × 12 + mes. Así restar 5 meses es simple.
  const latestMonth = latest.getUTCFullYear() * 12 + latest.getUTCMonth();
  // El primero de los 6 meses: el más reciente menos 5.
  const firstMonth = latestMonth - 5;
  // "counts" guarda cuántas fuentes hay por mes absoluto.
  const counts = new Map<number, number>();

  // Cuenta solo las fechas que caen dentro de la ventana de 6 meses.
  dates.forEach((date) => {
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
    /** Rama condicional: month >= firstMonth && month <= latestMonth. */
    if (month >= firstMonth && month <= latestMonth) {
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
  });

  // El formateador de nombres de mes en español, abreviado y con dos dígitos de año (por ejemplo "oct 26").
  const monthLabel = new Intl.DateTimeFormat("es-MX", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

  // Creamos los 6 meses en orden. "Math.floor(month / 12)" saca el año y "month % 12" el mes.
  // ".replace('.', '')" quita el punto que algunos meses abreviados traen.
  return Array.from({ length: 6 }, (_, index) => {
    const month = firstMonth + index;
    const date = new Date(Date.UTC(Math.floor(month / 12), month % 12, 1));
    return {
      label: monthLabel.format(date).replace(".", ""),
      count: counts.get(month) ?? 0,
    };
  });
}

/**
 * SourcesOverTimeChart dibuja la línea de "Fuentes consultadas con el tiempo". Cada mes es un punto
 * unido por una línea cian. Las marcas de la izquierda son el número de fuentes.
 *
 * Recibe: points, la lista de 6 meses que arma sourcesByMonth.
 *
 * Si no hay ninguna fuente, en lugar del dibujo se muestra un mensaje. Además, se incluye una lista
 * oculta (sr-only) con los mismos datos para lectores de pantalla.
 */
/** Componente SourcesOverTimeChart: renderiza la vista de graficas. */
function SourcesOverTimeChart({ points }: { points: ReturnType<typeof sourcesByMonth> }) {
  // Tamaño del dibujo y márgenes: left y right dejan espacio para los números y los bordes.
  // "top" y "bottom" son las alturas de la zona de datos, en unidades del dibujo.
  const width = 440;
  const height = 230;
  const left = 40;
  const right = 18;
  const top = 20;
  const bottom = 174;
  // El área útil de la gráfica.
  const chartWidth = width - left - right;
  const chartHeight = bottom - top;
  // El mes con más fuentes. "Math.max(1, ...)" evita dividir entre cero.
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  // La posición (x, y) de cada mes. x reparte los meses de izquierda a derecha; y sube según la cantidad.
  const coordinates = points.map((point, index) => ({
    ...point,
    x: left + (index / Math.max(1, points.length - 1)) * chartWidth,
    y: bottom - (point.count / maxCount) * chartHeight,
  }));
  // El texto de la línea. "M" mueve el lápiz al primer punto y "L" dibuja hasta cada siguiente.
  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  // Las marcas de la escala: cero, un tercio, dos tercios y el máximo. "new Set" quita repetidos.
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
      {/* Sin fuentes, un mensaje. Con fuentes, el dibujo y su lista de respaldo. */}
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
            {/* Las líneas guía horizontales con sus números. */}
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
            {/* La línea que une los meses. Su color viene de la variable de diseño --color-accent-cyan. */}
            <path d={line} fill="none" stroke="var(--color-accent-cyan)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {/* Un punto por mes y el nombre del mes debajo. */}
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
          {/* Lista oculta a la vista ("sr-only"), pero leída por lectores de pantalla: mismo dato en texto. */}
          <ul className="sr-only" aria-label="Fuentes encontradas por mes">
            {coordinates.map((point) => <li key={point.label}>{point.label}: {point.count}</li>)}
          </ul>
        </>
      )}
    </GlassPanel>
  );
}

/**
 * CountChartProps son los datos que necesita cualquier gráfica de conteo. Son los mismos para barras,
 * pastel o dona, por eso cambiar el tipo no obliga a cambiar los datos.
 */
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
 *
 * - "barras": usa CountBarChart.
 * - "pastel" y "dona": usan PieChart. La diferencia es "donut": true (hueco en el centro) solo para "dona".
 *
 * "...props" pasa todo lo demás (id, título, datos, icono) sin escribirlo uno por uno.
 */
/** Componente CountChart: renderiza la vista de graficas. */
function CountChart({ tipo, ...props }: CountChartProps & { tipo: TipoGrafica }) {
  // "barras" usa la gráfica de barras original.
  if (tipo === "barras") return <CountBarChart {...props} />;
  // "pastel" y "dona" usan el componente de pastel; "dona" activa el hueco del centro.
  return <PieChart {...props} donut={tipo === "dona"} />;
}

/**
 * VisualizationsTab dibuja la pestaña completa. Pide resultados, competidores y fuentes, y arma cada
 * gráfica con esos datos. Muestra cargando, error (con reintentar) o las gráficas.
 *
 * Reglas de conteo:
 * - Revisión de resultados: cuenta todos los resultados del proyecto, sin filtro.
 * - Alternativas: no cuenta las que están rechazadas.
 * - Temas, fuentes y tiempo: cuentan todos los datos disponibles.
 * Si no hay ningún dato, muestra un mensaje de orientación, pero igual dibuja las gráficas vacías.
 */
/** Expone la funcion visualizations tab para el flujo de visualizations. */
export function VisualizationsTab() {
  // El proyecto que entregó el detalle.
  const { project } = useProjectOutlet();
  // Los resultados (sin filtro, todos), los competidores y las fuentes del proyecto.
  const findings = useFindings(project.id, {});
  const competitors = useCompetitors(project.id);
  const sources = useSources(project.id);

  // Caso 1: cargando. Si alguna de las tres consultas todavía espera, mostramos la ruedita.
  /** Rama condicional: findings.isPending || competitors.isPending || sources.. */
  if (findings.isPending || competitors.isPending || sources.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Preparando visualizaciones…
      </div>
    );
  }

  // Caso 2: alguna consulta falló. Mostramos el primer error que exista y un botón para reintentar las tres.
  /** Rama condicional: findings.isError || competitors.isError || sources.isEr. */
  if (findings.isError || competitors.isError || sources.isError) {
    // "??" toma el primer error que exista, en el orden: resultados, competidores y fuentes.
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

  // Lista de categorías y de tipos de fuente, tomadas de los diccionarios de nombres.
  const categories = Object.keys(CATEGORY_LABELS) as ResearchCategory[];
  const sourceTypes = Object.keys(SOURCE_TYPE_LABELS) as SourceType[];
  // Un contador en cero para cada categoría. "fromEntries" arma el diccionario a partir de pares [nombre, 0].
  const categoryCounts = Object.fromEntries(categories.map((category) => [category, 0])) as Record<
    ResearchCategory,
    number
  >;
  // Cuántos resultados hay en cada estado de revisión. "filter" cuenta los que coinciden.
  const reviewCounts = Object.fromEntries(
    REVIEW_ORDER.map((status) => [status, findings.data.filter((finding) => finding.review_status === status).length]),
  ) as Record<ReviewStatus, number>;
  // Suma uno a la categoría de cada resultado.
  findings.data.forEach((finding) => {
    categoryCounts[finding.finding_type] += 1;
  });

  // Los competidores que no están rechazados. Los rechazados no se cuentan en la gráfica.
  const activeCompetitors = competitors.data.filter((competitor) => competitor.review_status !== "rejected");
  // Un contador en cero para cada tipo de competidor, luego se suma uno por cada competidor activo.
  const competitorCounts = Object.fromEntries(COMPETITOR_TYPES.map((type) => [type, 0])) as Record<
    CompetitorType,
    number
  >;
  activeCompetitors.forEach((competitor) => {
    competitorCounts[competitor.competitor_type] += 1;
  });

  // Un contador en cero para cada tipo de fuente, luego se suma uno por cada fuente.
  const sourceCounts = Object.fromEntries(sourceTypes.map((type) => [type, 0])) as Record<SourceType, number>;
  sources.data.forEach((source) => {
    sourceCounts[source.source_type] += 1;
  });
  // La línea de tiempo de los últimos 6 meses (ver sourcesByMonth).
  const sourceTimeline = sourcesByMonth(sources.data);
  // ¿Hay al menos un dato en alguna de las tres fuentes? Si no, se muestra el mensaje de orientación.
  const hasData = findings.data.length + activeCompetitors.length + sources.data.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* El título de la pestaña y el nombre del proyecto. */}
      <header>
        <h2 className="text-lg font-semibold">Visualizaciones del proyecto</h2>
        <p className="text-sm text-slate-400">
          Una vista sencilla de la investigación, las fuentes y las alternativas de{" "}
          <span className="font-medium text-slate-200">{project.title}</span>.
        </p>
      </header>
      {/* Sin datos, un mensaje. Las gráficas de abajo se siguen mostrando (en cero). */}
      {!hasData && (
        <EmptyState
          icon={FiBarChart2}
          title="Aún no hay datos para graficar"
          description="Al investigar la idea, los gráficos mostrarán qué se encontró y qué falta revisar."
        />
      )}
      {/* Las cinco gráficas. Cada bloque "TIPO_*" decide si se ve barras, pastel, dona o línea. */}
      <div className="grid gap-5 2xl:grid-cols-2">
        {/* Gráfica 1: temas que aparecen. */}
        <CountChart
          tipo={TIPO_TEMAS}
          id="category-chart"
          title="Temas que aparecen"
          explanation="Te muestra qué temas —como mercado, clientes o competencia— aparecen más en la investigación."
          entries={categories.map((category) => ({ label: CATEGORY_LABELS[category], count: categoryCounts[category] }))}
          icon={FiBarChart2}
        />
        {/* Gráfica 2: revisión de resultados. Si es "dona", usa el dibujo propio ReviewStatusChart; si no, el genérico. */}
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
        {/* Gráfica 3: alternativas encontradas, con su color por tipo. */}
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
        {/* Gráfica 4: de dónde viene la información, por tipo de sitio. */}
        <CountChart
          tipo={TIPO_FUENTES}
          id="sources-chart"
          title="De dónde viene la información"
          explanation="Resume qué tipos de sitios aportan información, por ejemplo noticias, gobierno o páginas académicas."
          entries={sourceTypes.map((type) => ({ label: SOURCE_TYPE_LABELS[type], count: sourceCounts[type] }))}
          icon={FiBookOpen}
        />
        {/* Gráfica 5: fuentes con el tiempo. Si es "lineas", usa el dibujo de línea; si es "barras", una barra por mes. */}
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
