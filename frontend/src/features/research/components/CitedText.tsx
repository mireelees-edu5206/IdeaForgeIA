import type { Evidence } from "../types";

export interface TextSegment {
  text: string;
  sourceIds: string[];
}

/** Divide la respuesta en tramos, indicando qué fuentes respaldan cada uno (según la evidencia). */
export function segmentText(text: string, evidence: Evidence[]): TextSegment[] {
  const spans = evidence.flatMap((item) =>
    item.span_start !== null && item.span_end !== null && item.span_start >= 0 && item.span_end <= text.length
      ? [{ start: item.span_start, end: item.span_end, sourceId: item.source_id }]
      : [],
  );
  const cuts = [...new Set([0, text.length, ...spans.flatMap((s) => [s.start, s.end])])].sort((a, b) => a - b);
  const segments: TextSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [start, end] = [cuts[i]!, cuts[i + 1]!];
    const sourceIds = [...new Set(spans.filter((s) => s.start <= start && s.end >= end).map((s) => s.sourceId))];
    const previous = segments.at(-1);
    if (previous && previous.sourceIds.join() === sourceIds.join()) previous.text += text.slice(start, end);
    else segments.push({ text: text.slice(start, end), sourceIds });
  }
  return segments;
}

interface CitedTextProps {
  text: string;
  evidence: Evidence[];
  /** Número visible de cada fuente en la lista de la consulta. */
  sourceNumbers: Map<string, number>;
  anchorPrefix: string;
  onHighlightSources?: (numbers: number[]) => void;
}

/** Resalta los fragmentos respaldados por una fuente; el resto es redacción de la IA sin cita. */
export function CitedText({
  text,
  evidence,
  sourceNumbers,
  anchorPrefix,
  onHighlightSources,
}: CitedTextProps) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
      {segmentText(text, evidence).map((segment, index) => {
        if (segment.sourceIds.length === 0 || !segment.text.trim()) return <span key={index}>{segment.text}</span>;
        const numbers = segment.sourceIds
          .map((id) => sourceNumbers.get(id))
          .filter((n): n is number => n !== undefined)
          .sort((a, b) => a - b);
        return (
          <span
            key={index}
            onMouseEnter={() => onHighlightSources?.(numbers)}
            onMouseLeave={() => onHighlightSources?.([])}
            className="group/cite relative"
          >
            <mark className="rounded bg-kind-evidence/15 px-1 text-slate-50 underline decoration-kind-evidence/60 decoration-dotted underline-offset-4 transition group-hover/cite:bg-kind-evidence/25">
              {segment.text}
            </mark>
            {numbers.map((n) => (
              <sup key={n} className="ml-0.5">
                <a
                  href={`#${anchorPrefix}-${n}`}
                  aria-label={`Fuente ${n}`}
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
