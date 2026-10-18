import { useState } from "react";
import { FiAlertCircle, FiChevronDown, FiExternalLink, FiSearch } from "react-icons/fi";

import { FilamentBridgeGlyph } from "../../../components/ui/ForgeGlyphs";
import { Spinner } from "../../../components/ui/Spinner";
import { cn } from "../../../lib/cn";
import { QUERY_STATUS_LABELS, safeHref } from "../constants";
import type { ResearchQuery } from "../types";
import { CategoryBadge, SourceTypeBadge } from "./badges";
import { CitedText } from "./CitedText";
import { SearchSuggestions } from "./SearchSuggestions";

export function QueryCard({ query, defaultOpen }: { query: ResearchQuery; defaultOpen: boolean }) {
  const [highlightedSources, setHighlightedSources] = useState<number[]>([]);
  const anchorPrefix = `fuente-${query.id}`;
  const sourceNumbers = new Map(query.sources.map((source, index) => [source.source_id, index + 1]));
  const cited = query.sources.filter((s) => s.was_cited).length;

  return (
    <details open={defaultOpen} className="glass group rounded-3xl">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-3xl p-4 focus-visible:outline-2 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <CategoryBadge category={query.category} />
            <span className={query.status === "failed" ? "text-rose-300" : undefined}>
              {QUERY_STATUS_LABELS[query.status]}
            </span>
            {query.status === "completed" && (
              <span>
                · {cited} {cited === 1 ? "fuente citada" : "fuentes citadas"}
              </span>
            )}
          </div>
          <h3 className="font-medium text-slate-100">{query.question}</h3>
        </div>
        <FiChevronDown aria-hidden="true" className="mt-1 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-4 border-t border-slate-400/15 p-4 sm:p-5">
        {query.status === "pending" && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-300">
            <Spinner className="size-4 text-accent-cyan" /> Esperando la respuesta…
          </p>
        )}
        {query.status === "failed" && (
          <p className="flex items-center gap-2 text-sm text-rose-200">
            <FiAlertCircle aria-hidden="true" /> No se pudo obtener respuesta para esta pregunta.
          </p>
        )}
        {query.response_text && (
          <CitedText
            text={query.response_text}
            evidence={query.evidence}
            sourceNumbers={sourceNumbers}
            anchorPrefix={anchorPrefix}
            onHighlightSources={setHighlightedSources}
          />
        )}

        {query.executed_queries.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-slate-400">Búsquedas realizadas por la IA</h4>
            <ul className="flex flex-wrap gap-2">
              {query.executed_queries.map((text) => (
                <li key={text} className="neo-inset flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-slate-300">
                  <FiSearch aria-hidden="true" className="size-3" /> {text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {query.sources.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-medium text-slate-400">Fuentes</h4>
              {highlightedSources.length > 0 && (
                <span className="font-mono-tech inline-flex items-center gap-1.5 text-[11px] text-kind-evidence">
                  <FilamentBridgeGlyph className="h-3.5 w-10" />
                  Hilo activo → [{highlightedSources.join(", ")}]
                </span>
              )}
            </div>
            <ol className="flex flex-col gap-2">
              {query.sources.map((source, index) => {
                const number = index + 1;
                const activeFilament = highlightedSources.includes(number);
                const href = safeHref(source.url);
                return (
                  <li
                    key={source.source_id}
                    id={`${anchorPrefix}-${number}`}
                    className={cn(
                      "neo-inset flex scroll-mt-24 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm transition target:ring-2 target:ring-kind-evidence/60",
                      activeFilament && "ring-2 ring-kind-evidence bg-kind-evidence/10",
                    )}
                  >
                    <span className="font-mono-tech font-semibold text-kind-evidence">[{number}]</span>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex min-w-0 items-center gap-1 break-all text-slate-100 hover:text-accent-cyan hover:underline"
                      >
                        {source.title ?? source.domain}
                        <FiExternalLink aria-hidden="true" className="size-3 shrink-0" />
                        <span className="sr-only">(se abre en una pestaña nueva)</span>
                      </a>
                    ) : (
                      <span className="break-all text-slate-100">{source.title ?? source.domain}</span>
                    )}
                    <span className="text-xs text-slate-400">{source.domain}</span>
                    <SourceTypeBadge type={source.source_type} />
                    <span className={source.was_cited ? "text-xs text-kind-evidence" : "text-xs text-slate-500"}>
                      {source.was_cited ? "Citada" : "Consultada, no citada"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {query.search_suggestions_html && <SearchSuggestions html={query.search_suggestions_html} />}
      </div>
    </details>
  );
}
