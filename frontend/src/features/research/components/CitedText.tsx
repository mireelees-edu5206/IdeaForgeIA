/**
 * ARCHIVO: research/components/CitedText.tsx
 *
 * ¿Qué es?
 * Es el texto de la respuesta de la IA con "citas" visibles. Los fragmentos que tienen una fuente
 * que los respalda se ven resaltados y con un número, por ejemplo "[2]". Lo que no tiene fuente
 * se ve normal. Así la persona sabe qué está comprobado y qué es solo redacción de la IA.
 *
 * ¿Para qué sirve?
 * Cumple la regla central del proyecto: distinguir lo que tiene respaldo de lo que es interpretación.
 * Al pasar el mouse sobre un fragmento resaltado, se iluminan las fuentes que lo respaldan.
 *
 * ¿Cómo funciona por dentro?
 * 1. segmentText parte la respuesta en trozos, según las posiciones de inicio y fin de cada evidencia.
 * 2. Cada trozo sabe qué fuentes lo respaldan.
 * 3. CitedText dibuja cada trozo: los respaldados con resaltado y número, los demás como texto normal.
 *
 * ¿Quién lo usa?
 * QueryCard.tsx (la respuesta de cada pregunta).
 */

/* Tipo de una evidencia: un fragmento con su posición dentro de la respuesta. */
import type { Evidence } from "../types";

/**
 * TextSegment es un trozo de la respuesta:
 * - text: el texto de ese trozo.
 * - sourceIds: los identificadores de las fuentes que lo respaldan (lista vacía si no tiene respaldo).
 */
/** Describe el contrato text segment utilizado por research. */
export interface TextSegment {
  text: string;
  sourceIds: string[];
}

/**
 * segmentText parte la respuesta en trozos según las evidencias.
 *
 * Recibe:
 * - text: la respuesta completa.
 * - evidence: la lista de evidencias, cada una con su posición de inicio (span_start) y fin (span_end).
 *
 * Devuelve: la lista de trozos, en orden, cubriendo el texto completo sin huecos ni repeticiones.
 *
 * Cómo lo hace (paso a paso):
 * 1. Toma solo las evidencias con posiciones válidas (dentro del texto y con inicio menor que fin).
 * 2. Junta todos los puntos de corte: el inicio y el fin de cada evidencia, más el principio y el final del texto.
 * 3. Ordena los cortes. Entre cada par de cortes consecutivos hay un trozo.
 * 4. Para cada trozo, busca qué evidencias lo cubren por completo.
 * 5. Si dos trozos seguidos tienen las mismas fuentes, los une en uno solo.
 */
/** Divide la respuesta en tramos, indicando qué fuentes respaldan cada uno (según la evidencia). */
export function segmentText(text: string, evidence: Evidence[]): TextSegment[] {
  // Paso 1: convertimos cada evidencia válida en un rango {inicio, fin, fuente}. "flatMap" descarta las inválidas.
  const spans = evidence.flatMap((item) =>
    item.span_start !== null && item.span_end !== null && item.span_start >= 0 && item.span_end <= text.length
      ? [{ start: item.span_start, end: item.span_end, sourceId: item.source_id }]
      : [],
  );
  // Paso 2 y 3: todos los puntos de corte, sin repetir ("new Set"), ordenados de menor a mayor.
  const cuts = [...new Set([0, text.length, ...spans.flatMap((s) => [s.start, s.end])])].sort((a, b) => a - b);
  const segments: TextSegment[] = [];
  // Recorremos cada par de cortes consecutivos: cada par forma un trozo.
  for (let i = 0; i < cuts.length - 1; i++) {
    // El "!" le dice a TypeScript que estos índices sí existen dentro del bucle.
    const [start, end] = [cuts[i]!, cuts[i + 1]!];
    // Paso 4: fuentes de las evidencias que cubren todo el trozo (su inicio es antes o igual, y su fin es después o igual).
    const sourceIds = [...new Set(spans.filter((s) => s.start <= start && s.end >= end).map((s) => s.sourceId))];
    // Paso 5: si el trozo anterior tiene las mismas fuentes, le pegamos este texto en lugar de crear otro trozo.
    const previous = segments.at(-1);
    if (previous && previous.sourceIds.join() === sourceIds.join()) previous.text += text.slice(start, end);
    else segments.push({ text: text.slice(start, end), sourceIds });
  }
  return segments;
}

/**
 * CitedTextProps describe lo que recibe el texto citado:
 * - text: la respuesta.
 * - evidence: sus evidencias.
 * - sourceNumbers: un diccionario que dice qué número tiene cada fuente en la lista (1, 2, 3...).
 * - anchorPrefix: un prefijo para que cada número [n] enlace a su fuente en la lista.
 * - onHighlightSources (opcional): función que avisa a la lista qué fuentes iluminar al pasar el mouse.
 */
/** Contrato de datos CitedTextProps utilizado por investigacion. */
interface CitedTextProps {
  text: string;
  evidence: Evidence[];
  /** Número visible de cada fuente en la lista de la consulta. */
  sourceNumbers: Map<string, number>;
  anchorPrefix: string;
  onHighlightSources?: (numbers: number[]) => void;
}

/**
 * CitedText dibuja el párrafo con sus citas.
 *
 * Qué ve la persona:
 * - Texto resaltado en verde con número: tiene respaldo. Al pasar el mouse, se iluminan sus fuentes.
 * - Texto normal: redacción de la IA sin cita. Hay que tratarlo como interpretación.
 * - El número [n] es un enlace: al tocarlo, baja a la fuente correspondiente en la lista.
 */
/** Resalta los fragmentos respaldados por una fuente; el resto es redacción de la IA sin cita. */
export function CitedText({
  text,
  evidence,
  sourceNumbers,
  anchorPrefix,
  onHighlightSources,
}: CitedTextProps) {
  return (
    // "whitespace-pre-wrap" respeta los saltos de línea de la respuesta original.
    <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
      {/* Dibujamos cada trozo. "map" repite el dibujo y "index" sirve de clave. */}
      {segmentText(text, evidence).map((segment, index) => {
        // Caso sin respaldo, o trozo solo con espacios: se dibuja como texto normal.
        if (segment.sourceIds.length === 0 || !segment.text.trim()) return <span key={index}>{segment.text}</span>;
        // Caso con respaldo: buscamos el número de cada fuente y los ordenamos.
        // ".filter((n): n is number => ...)" descarta las fuentes que no estén en la lista.
        const numbers = segment.sourceIds
          .map((id) => sourceNumbers.get(id))
          .filter((n): n is number => n !== undefined)
          .sort((a, b) => a - b);
        return (
          <span
            key={index}
            // Al pasar el mouse por el fragmento, avisamos qué fuentes iluminar. Al salir, apagamos todo.
            onMouseEnter={() => onHighlightSources?.(numbers)}
            onMouseLeave={() => onHighlightSources?.([])}
            className="group/cite relative"
          >
            {/* El texto resaltado: fondo verde suave, subrayado punteado. "group-hover" lo intensifica al pasar el mouse. */}
            <mark className="rounded bg-kind-evidence/15 px-1 text-slate-50 underline decoration-kind-evidence/60 decoration-dotted underline-offset-4 transition group-hover/cite:bg-kind-evidence/25">
              {segment.text}
            </mark>
            {/* Los números de cita, como superíndice. Cada uno es un enlace a su fuente en la lista. */}
            {numbers.map((n) => (
              <sup key={n} className="ml-0.5">
                <a
                  href={`#${anchorPrefix}-${n}`}
                  aria-label={`Fuente ${n}`}
                  // Con teclado, al enfocar el número también se ilumina su fuente (igual que con el mouse).
                  onFocus={() => onHighlightSources?.([n])}
                  onBlur={() => onHighlightSources?.([])}
                  className="font-mono-tech rounded px-0.5 font-semibold text-kind-evidence hover:underline"
                >
                  [{n}]
                </a>
              </sup>
            ))}
          </span>
        );
      })}
    </p>
  );
}
