/**
 * ARCHIVO: ForgeGlyphs.tsx
 *
 * ¿Qué es?
 * Es una colección de dibujos propios de IdeaForge, hechos con SVG. Un SVG es un dibujo escrito
 * con coordenadas (puntos, líneas, círculos), no una foto; por eso se ve nítido a cualquier tamaño.
 * "Glyph" significa "símbolo" o "dibujito".
 *
 * ¿Para qué sirve?
 * Cada dibujo representa una idea de la marca:
 * - CrucibleGlyph: el logo (el crisol de la forja, con un núcleo en el centro).
 * - StageSealGlyph: un sello que cambia de forma según la etapa del proyecto.
 *   Va de piedra sin pulir (borrador) a cristal tallado (analizado).
 * - FacetTriadGlyph: tres caras de un cristal que se encienden según cuántos datos obligatorios
 *   ya están confirmados (problema, solución, segmento).
 * - FilamentBridgeGlyph: una línea con tres puntos que representa el hilo de trazabilidad
 *   (dato → evidencia → fuente).
 *
 * ¿Quién lo usa?
 * Logo.tsx, AuthLayout.tsx, las tarjetas de proyectos y la pantalla de estructura de la idea.
 *
 * ¿Cómo se cambia un color o una forma?
 * - Color: cada dibujo usa "currentColor", que significa "el mismo color que el texto a su alrededor".
 *   Para cambiarlo, cambia la clase de color en el lugar donde se usa el dibujo (por ejemplo "text-accent-cyan").
 * - Forma: cambia los valores de "points" (polígonos), "d" (trazos) o "cx, cy, r" (círculos).
 */

/* Traemos el tipo "SVGProps": la lista de propiedades que acepta una etiqueta <svg> normal (className, onClick...). */
import type { SVGProps } from "react";

/* Traemos el tipo ProjectStatus: la lista de etapas de un proyecto (draft, structured, researching, analyzed). */
import type { ProjectStatus } from "../../features/projects/types";

/**
 * GlyphProps es el tipo de propiedades que aceptan los dibujos: cualquiera de una etiqueta <svg>.
 * Así, desde afuera se les puede pasar className, width, etc.
 */
/** Contrato de datos GlyphProps utilizado por interfaz compartida. */
type GlyphProps = SVGProps<SVGSVGElement>;

/**
 * CrucibleGlyph es el emblema de IdeaForge: un hexágono (figura de seis lados) con líneas
 * que se cruzan en el centro y un punto brillante en el medio, como el núcleo de la forja.
 *
 * Cómo se usa: <CrucibleGlyph className="size-5 text-accent-cyan" />
 */
/** Emblema del Crisol de IdeaForge: núcleo octaédrico dentro de un anillo de forja. */
export function CrucibleGlyph(props: GlyphProps) {
  return (
    // "viewBox" define el área de dibujo en unidades de 24 x 24. "fill none" = no rellenar las figuras, solo dibujar sus bordes.
    // "aria-hidden" esconde el dibujo de los lectores de pantalla porque es decorativo.
    // "{...props}" permite cambiar tamaño y color desde afuera.
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      {/* El contorno del hexágono. "strokeLinejoin round" redondea las esquinas. */}
      <path
        d="M12 2.5 19.5 8v8L12 21.5 4.5 16V8L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Las líneas internas: una vertical y dos diagonales que se cruzan en el centro. Son más finas y un poco transparentes. */}
      <path
        d="M12 2.5v19M4.5 8l15 8M19.5 8l-15 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.55"
      />
      {/* El núcleo: un círculo relleno en el centro del dibujo. */}
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}

/**
 * StageSealGlyph dibuja un sello distinto para cada etapa del proyecto.
 * Recibe "status" (la etapa) y "className" (el tamaño y color desde afuera).
 * Cada "if" revisa una etapa y devuelve su dibujo; la última línea es el dibujo final, para "analyzed".
 */
/** Sello material por estado del proyecto (piedra bruta → metal → incandescente → cristal tallado). */
export function StageSealGlyph({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  // Etapa 1, "draft" (borrador): una piedra irregular con borde punteado y relleno casi invisible. Es la materia sin trabajar.
  if (status === "draft") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        {/* "strokeDasharray 3 2.5" hace que el borde sea de rayitas, como algo todavía sin terminar. */}
        <polygon
          points="14,3 24,9 22,21 8,24 4,12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="3 2.5"
          fill="currentColor"
          fillOpacity="0.08"
        />
        {/* Un puntito en el centro, medio transparente. */}
        <circle cx="14" cy="14" r="2.2" fill="currentColor" fillOpacity="0.5" />
      </svg>
    );
  }
  // Etapa 2, "structured" (estructurado): un hexágono sólido con tres líneas que lo dividen. Ya tiene forma.
  if (status === "structured") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        <polygon
          points="14,3 24,8.5 24,19.5 14,25 4,19.5 4,8.5"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="currentColor"
          fillOpacity="0.12"
        />
        {/* Las tres líneas internas que muestran la estructura. */}
        <path d="M14 3v22M4 8.5l20 11M24 8.5l-20 11" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" />
      </svg>
    );
  }
  // Etapa 3, "researching" (investigando): un círculo punteado que gira en la imaginación, con un rombo incandescente dentro.
  if (status === "researching") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        {/* El anillo punteado da idea de algo en proceso. */}
        <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 2" />
        {/* El rombo central, con un relleno más intenso: la materia ya se calienta. */}
        <polygon
          points="14,5.5 21.5,14 14,22.5 6.5,14"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <circle cx="14" cy="14" r="2.6" fill="currentColor" />
      </svg>
    );
  }
  // Etapa 4 (la última, "analyzed" y cualquier otro valor): un cristal tallado, con facetas. Es el resultado terminado.
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      {/* El contorno exterior del cristal. */}
      <polygon
        points="14,2.5 23.5,8 23.5,20 14,25.5 4.5,20 4.5,8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="currentColor"
        fillOpacity="0.18"
      />
      {/* La faceta interior: un rombo que simula la luz dentro del cristal. */}
      <polygon points="14,7 19.5,14 14,21 8.5,14" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="14" cy="14" r="2.2" fill="currentColor" />
    </svg>
  );
}

/**
 * FacetTriadGlyph dibuja tres caras de un cristal. Cada cara que está "encendida" se pinta
 * con más color.
 *
 * Recibe "lit": cuántas caras están encendidas (0, 1, 2 o 3). Por ejemplo, lit = 2 enciende las dos primeras.
 */
/** Indicador geométrico de las 3 facetas obligatorias (Problema, Solución, Segmento). */
export function FacetTriadGlyph({ lit }: { lit: number }) {
  // Las tres caras, cada una como un trazo (la forma de una porción del cristal).
  const facets = [
    "M14 3 23 9.5 14 14Z",
    "M23 9.5 19.5 21 14 14Z",
    "M14 14 19.5 21 8.5 21 5 9.5 14 3Z",
  ];
  return (
    <svg viewBox="0 0 28 24" className="size-6 shrink-0" aria-hidden="true">
      {/* Dibujamos una cara por cada trazo de la lista. "map" repite el dibujo y "index" dice cuál es. */}
      {facets.map((d, index) => {
        // Una cara está encendida si su posición es menor que "lit". Con lit=2, las posiciones 0 y 1 se encienden.
        const active = index < lit;
        return (
          <path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            // El relleno usa el mismo color que el texto a su alrededor.
            fill="currentColor"
            // Encendida: relleno bastante visible (0.38). Apagada: casi transparente (0.06).
            fillOpacity={active ? 0.38 : 0.06}
            // Encendida: color celeste de acento. Apagada: gris.
            className={active ? "text-accent-cyan" : "text-slate-400"}
          />
        );
      })}
    </svg>
  );
}

/**
 * FilamentBridgeGlyph dibuja una línea ondulada con tres puntos: el inicio (un dato), el medio
 * (una evidencia) y el final (una fuente). Simboliza que todo está conectado y se puede rastrear.
 */
/** Hilo óptico de trazabilidad entre dos nodos (dato → evidencia → fuente). */
export function FilamentBridgeGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 16" fill="none" aria-hidden="true" {...props}>
      {/* La línea curva punteada que une los tres puntos. */}
      <path
        d="M4 8C18 1 46 15 60 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 2"
      />
      {/* Punto de inicio, el más marcado. */}
      <circle cx="4" cy="8" r="2.5" fill="currentColor" />
      {/* Punto del medio, un poco más transparente (es el paso intermedio). */}
      <circle cx="32" cy="8" r="2" fill="currentColor" fillOpacity="0.65" />
      {/* Punto final, igual de marcado que el inicio. */}
      <circle cx="60" cy="8" r="2.5" fill="currentColor" />
    </svg>
  );
}
