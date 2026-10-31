/**
 * ARCHIVO: PieChart.tsx
 *
 * ¿Qué es?
 * Una gráfica de pastel (o de dona, que es un pastel con hueco en el centro).
 * Sirve para ver de un vistazo qué parte del total ocupa cada cosa, como una pizza
 * dividida en rebanadas: entre más grande la rebanada, mayor es su número.
 *
 * ¿Para qué sirve en IdeaForge?
 * Es la alternativa de pastel para las gráficas de barras de la pantalla de Visualizaciones
 * (VisualizationsTab.tsx) y del Laboratorio (AdminLabPage.tsx). La gráfica original no se borra:
 * cada pantalla decide qué tipo mostrar con una constante TIPO_* (ver la sección 11 de la guía).
 *
 * ¿Cómo funciona por dentro?
 * Dibuja un círculo con trazos (líneas gruesas). Cada rebanada es un trozo de ese círculo
 * con una longitud proporcional a su número. Como el círculo está girado -90 grados,
 * la primera rebanada empieza arriba, como las manecillas de un reloj a las 12.
 */

/* Traemos el tipo "IconType": la forma que tiene un icono de react-icons (para el dibujito del encabezado). */
import type { IconType } from "react-icons";

/* Traemos "GlassPanel": la tarjeta de cristal que envuelve la gráfica, igual que las demás. */
import { GlassPanel } from "./GlassPanel";

/**
 * FALLBACK_COLORS es la lista de colores que se usan cuando una rebanada no trae color propio.
 * Son colores en formato hexadecimal (#rrggbb), porque el dibujo SVG no entiende las clases de Tailwind.
 */
const FALLBACK_COLORS = [
  "#38bdf8", // celeste
  "#34d399", // verde
  "#fbbf24", // ámbar
  "#fb7185", // rosa
  "#a78bfa", // lila
  "#f97316", // naranja
  "#22d3ee", // turquesa
  "#94a3b8", // gris
];

/**
 * PieEntry describe una rebanada: su nombre (label), su número (count) y, opcionalmente, su color.
 * El color solo se usa si empieza con "#" (hexadecimal). Si no, se toma uno de FALLBACK_COLORS.
 */
export interface PieEntry {
  label: string;
  count: number;
  color?: string;
}

/**
 * PieChart dibuja el pastel completo: encabezado, círculo con rebanadas y leyenda.
 *
 * Cómo se usa (ejemplo):
 * <PieChart id="temas" title="Temas" explanation="..." icon={FiPieChart}
 *   entries={[{ label: "Mercado", count: 3 }, { label: "Clientes", count: 1 }]} />
 *
 * Recibe:
 * - id: un nombre único para esta gráfica (sirve para lectores de pantalla).
 * - title y explanation: el título y la frase de ayuda que se ven arriba.
 * - entries: la lista de rebanadas.
 * - icon: el dibujito del encabezado.
 * - donut (opcional): si es true, se dibuja como dona (con hueco en el centro).
 *
 * Qué hace si no hay datos: muestra un aviso "Todavía no hay datos para mostrar".
 */
export function PieChart({
  id,
  title,
  explanation,
  entries,
  icon: Icon,
  donut = false,
}: {
  id: string;
  title: string;
  explanation: string;
  entries: PieEntry[];
  icon: IconType;
  donut?: boolean;
}) {
  // Sumamos todos los números para saber el total. Cada rebanada será una parte de ese total.
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  // Pastel: radio 25 con trazo de 50 llena todo el círculo (no deja hueco).
  // Dona: radio 35 con trazo de 18 deja un hueco en el centro.
  const radius = donut ? 35 : 25;
  const strokeWidth = donut ? 18 : 50;
  // La circunferencia es el "largo" total del círculo: 2 × π × radio.
  const circumference = 2 * Math.PI * radius;

  // Calculamos cada rebanada: cuánto largo ocupa (dash) y en qué punto empieza (dashOffset).
  // "offset" lleva la cuenta de dónde termina la rebanada anterior, para pegar la siguiente.
  let offset = 0;
  const slices = entries.map((entry, index) => {
    // Si el total es 0, la rebanada mide 0 (no se dibuja nada).
    const length = total > 0 ? (entry.count / total) * circumference : 0;
    const slice = {
      ...entry,
      // Usamos el color propio solo si es hexadecimal; si no, tomamos uno de la lista según la posición.
      color: entry.color?.startsWith("#")
        ? entry.color
        : (FALLBACK_COLORS[index % FALLBACK_COLORS.length] ?? "#94a3b8"),
      // "dash" dice: dibuja "length" y luego deja un hueco del resto del círculo.
      dash: `${length} ${circumference - length}`,
      // "dashOffset" mueve el inicio del trazo para que cada rebanada empiece donde terminó la anterior.
      dashOffset: -offset,
    };
    offset += length;
    return slice;
  });

  return (
    // role="region" y aria-labelledby ayudan a lectores de pantalla a encontrar la gráfica por su título.
    <GlassPanel role="region" aria-labelledby={`${id}-title`} className="stage-3d flex flex-col gap-5 p-5">
      {/* Encabezado: icono, título y frase de ayuda. Es igual al de las gráficas de barras. */}
      <div className="flex items-start gap-3">
        <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h3 id={`${id}-title`} className="font-semibold">
            {title}
          </h3>
          <p className="text-xs leading-relaxed text-slate-400">{explanation}</p>
        </div>
      </div>

      {total === 0 ? (
        // Sin datos: en lugar de un círculo vacío, mostramos un aviso.
        <p className="neo-inset rounded-xl px-4 py-8 text-center text-sm text-slate-400">
          Todavía no hay datos para mostrar.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
          {/* El dibujo. "-rotate-90" gira el círculo para que la primera rebanada empiece arriba. */}
          {/* aria-label describe todos los números para personas que no ven el dibujo. */}
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`${title}: ${entries.map((entry) => `${entry.label} ${entry.count}`).join(", ")}`}
            className="size-44 shrink-0 -rotate-90"
          >
            {slices.map(
              (slice) =>
                // Solo dibujamos rebanadas con número mayor a 0 (una rebanada de 0 no se ve).
                slice.count > 0 && (
                  <circle
                    key={slice.label}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={slice.dash}
                    strokeDashoffset={slice.dashOffset}
                  />
                ),
            )}
          </svg>

          {/* La leyenda: un punto de color, el nombre y el número de cada rebanada. */}
          {/* Es la lista que dice qué color es qué. Sin ella, el pastel no se entiende. */}
          <ul className="flex w-full flex-col gap-3 sm:w-auto" aria-label={`Leyenda: ${title}`}>
            {slices.map((slice) => (
              <li key={slice.label} className="flex items-center justify-between gap-6 text-sm">
                <span className="flex items-center gap-2 text-slate-300">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  {slice.label}
                </span>
                <span className="font-mono-tech font-semibold text-slate-100">{slice.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassPanel>
  );
}
