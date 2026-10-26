import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiFileText,
  FiMapPin,
  FiPrinter,
  FiRefreshCw,
} from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
import { TextArea } from "../../components/ui/TextArea";
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { useProjectOutlet } from "../projects/outlet";
import { safeHref } from "../research/constants";
import { useCreateReport, useReport, useReports } from "./queries";
import type { BusinessVerdict, GeographicScopeInput, ReportSection, ReportStatus } from "./types";

const REPORT_STATUS: Record<
  ReportStatus,
  { label: string; className: string; icon: typeof FiClock }
> = {
  generating: {
    label: "Generando",
    className: "bg-amber-400/15 text-amber-200 ring-amber-300/30",
    icon: FiClock,
  },
  completed: {
    label: "Listo",
    className: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30",
    icon: FiCheckCircle,
  },
  failed: {
    label: "Fallido",
    className: "bg-rose-400/15 text-rose-200 ring-rose-300/30",
    icon: FiAlertCircle,
  },
};

const REPORT_ERRORS: Record<string, string> = {
  ai_timeout: "La IA tardó demasiado en preparar el informe. Puedes generar otro.",
  ai_rate_limited: "La IA alcanzó su límite temporal. Inténtalo de nuevo más tarde.",
  ai_unavailable: "La IA no está disponible ahora. Tus datos siguen guardados.",
  ai_invalid_response: "La IA no devolvió un informe con el formato esperado.",
  report_generation_failed: "No se pudo completar el informe. Puedes volver a intentarlo.",
};

export function ReportsTab() {
  const { project } = useProjectOutlet();
  const [searchParams] = useSearchParams();
  const reports = useReports(project.id);
  const createReport = useCreateReport(project.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reportId = selectedId ?? reports.data?.[0]?.id ?? null;
  const report = useReport(project.id, reportId);
  const [geographicScopeText, setGeographicScopeText] = useState(() =>
    searchParams.get("zona")?.trim() ||
      project.attributes
        .filter((attribute) => attribute.attribute_type === "geographic_scope" && attribute.is_confirmed)
        .map((attribute) => attribute.value)
      .join("\n"),
  );
  const geographicScopeCount = geographicScopeText.split(/\r?\n/).filter((scope) => scope.trim()).length;

  useEffect(() => {
    if (!selectedId && reports.data?.[0]) setSelectedId(reports.data[0].id);
  }, [reports.data, selectedId]);

  async function generateReport() {
    try {
      const geographicScopes = geographicScopeText
        .split(/\r?\n/)
        .map((scope) => scope.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((query): GeographicScopeInput => {
          const selectedArea = searchParams.get("zona")?.trim();
          const latitudeText = searchParams.get("lat");
          const longitudeText = searchParams.get("lon");
          const latitude = Number(latitudeText);
          const longitude = Number(longitudeText);
          const radius = Number(searchParams.get("radio"));
          const keyword = searchParams.get("giro")?.trim();
          if (
            selectedArea === query &&
            latitudeText !== null &&
            longitudeText !== null &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180
          ) {
            return {
              query,
              latitude,
              longitude,
              radius_m: Number.isFinite(radius) && radius >= 100 && radius <= 5000 ? radius : 1000,
              ...(keyword ? { keyword } : {}),
            };
          }
          return { query };
        });
      const created = await createReport.mutateAsync(geographicScopes);
      setSelectedId(created.id);
    } catch {
      // createReport.error is displayed below.
    }
  }

  const generating = reports.data?.some((item) => item.status === "generating") ?? false;
  const canGenerate =
    project.status === "analyzed" &&
    !generating &&
    !createReport.isPending &&
    geographicScopeCount <= 3;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">DECISIÓN BASADA EN TU INFORMACIÓN</p>
          <h2 className="font-display mt-1 text-2xl font-bold">Veredicto final</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Revisa una recomendación basada en los resultados, las fuentes, las opciones y las zonas consultadas. No es una garantía de éxito.
          </p>
        </div>
        <Button
          icon={<FiFileText aria-hidden="true" />}
          loading={createReport.isPending}
          disabled={!canGenerate}
          onClick={generateReport}
        >
          Generar veredicto
        </Button>
      </header>

      <GlassPanel className="rounded-2xl p-4">
        <TextArea
          label="Zonas que quieres evaluar (opcional)"
          rows={2}
          maxLength={480}
          value={geographicScopeText}
          onChange={(event) => setGeographicScopeText(event.target.value)}
          placeholder={"Una zona por línea. Ej.:\nSan Mateo, Toluca\nCentro de Metepec"}
          hint="Una zona por línea, hasta tres. Se consultarán lugares registrados cerca; el mapa no muestra demanda ni precios de renta."
        />
      </GlassPanel>
      {geographicScopeCount > 3 && (
        <Alert tone="info">Elige hasta tres zonas para comparar en este veredicto.</Alert>
      )}

      {project.status !== "analyzed" && (
        <Alert tone="info">
          Completa la investigación y el análisis para preparar el veredicto.
        </Alert>
      )}
      {createReport.isError && <Alert>{errorMessageFrom(createReport.error)}</Alert>}
      {reports.isError && (
        <GlassPanel className="flex items-center justify-between gap-3 p-4">
          <Alert>{errorMessageFrom(reports.error)}</Alert>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reintentar carga de informes"
            onClick={() => void reports.refetch()}
          >
            <FiRefreshCw aria-hidden="true" />
          </Button>
        </GlassPanel>
      )}

      {reports.isPending ? (
        <div role="status" className="flex items-center gap-3 py-10 text-slate-300">
          <Spinner className="size-5 text-accent-cyan" />
          Cargando informes…
        </div>
      ) : reports.data?.length ? (
        <div className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Versiones del informe" className="flex gap-2 overflow-x-auto xl:flex-col">
            {reports.data.map((item) => {
              const status = REPORT_STATUS[item.status];
              const StatusIcon = status.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={item.id === reportId ? "page" : undefined}
                  onClick={() => setSelectedId(item.id)}
                  className={`neo-raised jelly min-w-44 rounded-2xl p-3 text-left transition xl:min-w-0 ${
                    item.id === reportId
                      ? "ring-1 ring-accent-cyan/45"
                      : "hover:ring-1 hover:ring-white/15"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold">Informe generado</span>
                    <Badge className={status.className}>
                      <StatusIcon aria-hidden="true" />
                      {status.label}
                    </Badge>
                  </span>
                  <span className="mt-2 block text-xs text-slate-400">
                    {formatDateTime(item.created_at)}
                  </span>
                </button>
              );
            })}
          </nav>

          <ReportDocument report={report.data} isPending={report.isPending} error={report.error} />
        </div>
      ) : (
        <GlassPanel className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="neo-raised grid size-12 place-items-center rounded-2xl text-accent-cyan">
            <FiFileText aria-hidden="true" className="size-5" />
          </span>
          <h3 className="font-display text-lg font-semibold">Tu veredicto aún no está listo</h3>
          <p className="max-w-md text-sm text-slate-400">
            Cuando el análisis esté listo, podrás revisar la recomendación, una inversión orientativa si hay datos suficientes y qué información falta.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}

function ReportDocument({
  report,
  isPending,
  error,
}: {
  report: ReturnType<typeof useReport>["data"];
  isPending: boolean;
  error: unknown;
}) {
  if (isPending) {
    return (
      <GlassPanel role="status" className="flex min-h-56 items-center justify-center gap-3 p-8">
        <Spinner className="size-5 text-accent-cyan" />
        Preparando el documento…
      </GlassPanel>
    );
  }
  if (error) return <Alert>{errorMessageFrom(error)}</Alert>;
  if (!report) return null;

  const status = REPORT_STATUS[report.status];
  const StatusIcon = status.icon;
  const complete = report.status === "completed";

  return (
    <GlassPanel id="report-print" className="min-w-0 rounded-3xl p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-400/15 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-bold">{report.title}</h3>
            <Badge className={status.className}>
              <StatusIcon aria-hidden="true" />
              {status.label}
            </Badge>
          </div>
        </div>
        {complete && (
          <div className="flex gap-2 print:hidden">
            <Button
              variant="secondary"
              size="sm"
              icon={<FiDownload aria-hidden="true" />}
              onClick={() => downloadMarkdown(report.title, report.sections)}
            >
              Descargar .md
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<FiPrinter aria-hidden="true" />}
              onClick={() => window.print()}
            >
              Imprimir / PDF
            </Button>
          </div>
        )}
      </header>

      {report.status === "generating" ? (
        <div role="status" className="flex items-center gap-3 py-8 text-slate-300">
          <span className="size-2 animate-pulse rounded-full bg-accent-cyan" />
          Revisando la información del proyecto para preparar una recomendación…
        </div>
      ) : report.status === "failed" ? (
        <Alert>
          {REPORT_ERRORS[report.error_code ?? ""] ??
            "No se pudo completar este informe. Puedes generar una nueva versión."}
        </Alert>
      ) : (
        <>
          {report.ai_provider === "fake" && (
            <Alert tone="info">
              Este veredicto es una demostración y no una evaluación real. No lo uses para decidir una inversión.
            </Alert>
          )}
          <ReportSections sections={report.sections} />
        </>
      )}
    </GlassPanel>
  );
}

function ReportSections({ sections }: { sections: ReportSection[] }) {
  const verdictSection = sections.find((section) => section.verdict);
  const detailSections = sections.filter((section) => section.id !== verdictSection?.id);

  if (!verdictSection?.verdict) {
    const summary = sections.find((section) => section.section_type === "executive_summary");
    const details = sections.filter((section) => section.id !== summary?.id);
    return (
      <>
        {summary && <ReportArticle section={summary} />}
        {details.length > 0 && (
          <details className="surface-panel rounded-2xl p-4">
            <summary className="jelly flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
              <span>Ver el informe completo</span>
              <span className="text-xs font-normal text-slate-400">{details.length} apartados</span>
            </summary>
            <div className="mt-4 flex flex-col gap-5 border-t border-border pt-4">
              {details.map((section) => <ReportArticle key={section.id} section={section} />)}
            </div>
          </details>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <VerdictCard verdict={verdictSection.verdict} summary={verdictSection.content} />
      <details className="surface-panel rounded-2xl p-4">
        <summary className="jelly flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
          <span>Ver el análisis completo</span>
          <span className="text-xs font-normal text-slate-400">{detailSections.length} apartados</span>
        </summary>
        <div className="mt-4 flex flex-col gap-5 border-t border-border pt-4">
          {detailSections.map((section) => (
            <ReportArticle key={section.id} section={section} />
          ))}
        </div>
      </details>
    </div>
  );
}

function ReportArticle({ section }: { section: ReportSection }) {
  return (
    <article>
      <h4 className="font-display mb-2 text-lg font-semibold">{section.title}</h4>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
        {linkify(section.content)}
      </p>
    </article>
  );
}

const VERDICT_META: Record<
  BusinessVerdict["recommendation"],
  { label: string; className: string }
> = {
  worth_testing: {
    label: "Vale la pena probarla en pequeño",
    className: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30",
  },
  needs_validation: {
    label: "Faltan pruebas importantes",
    className: "bg-amber-400/15 text-amber-200 ring-amber-300/30",
  },
  do_not_proceed_yet: {
    label: "No conviene avanzar todavía",
    className: "bg-rose-400/15 text-rose-200 ring-rose-300/30",
  },
  insufficient_information: {
    label: "Aún no hay datos suficientes",
    className: "bg-slate-400/15 text-slate-200 ring-slate-300/25",
  },
};

const CONFIDENCE_LABELS: Record<BusinessVerdict["confidence"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

function VerdictCard({ verdict, summary }: { verdict: BusinessVerdict; summary: string }) {
  const recommendation = VERDICT_META[verdict.recommendation];
  const investment = verdict.investment;
  const money = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

  return (
    <section aria-labelledby="veredicto-final" className="verdict-card rounded-3xl p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={recommendation.className}>{recommendation.label}</Badge>
        <Badge className="bg-primary/10 text-primary ring-primary/25">
          Confianza {CONFIDENCE_LABELS[verdict.confidence].toLowerCase()}
        </Badge>
      </div>
      <h4 id="veredicto-final" className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
        Recomendación actual
      </h4>
      <p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
        {linkify(summary)}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <section className="verdict-detail rounded-2xl p-4">
          <h5 className="font-semibold">Inversión inicial</h5>
          {investment ? (
            <>
              <p className="mt-2 font-display text-xl font-bold">
                {money.format(investment.minimum_mxn)}–{money.format(investment.maximum_mxn)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{investment.basis}</p>
              {investment.assumptions.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
                  {investment.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                </ul>
              )}
              {investment.evidence_refs.length > 0 && (
                <p className="mt-2 text-[11px] text-primary">
                  Basado en resultados: {investment.evidence_refs.map((ref) => `[${ref}]`).join(", ")}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">Rango orientativo; confirma costos con proveedores locales.</p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Aún no se puede estimar de forma responsable. Faltan costos o precios comprobables; no inventamos una cifra.
            </p>
          )}
        </section>

        <section className="verdict-detail rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <FiMapPin aria-hidden="true" className="text-primary" />
            <h5 className="font-semibold">Zonas para evaluar</h5>
          </div>
          {verdict.zones.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-3">
              {verdict.zones.map((zone) => (
                <li key={`${zone.name}-${zone.reason}`} className="text-sm">
                  <p className="font-medium">{zone.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{zone.reason}</p>
                  {zone.place_refs.length > 0 && (
                    <p className="mt-1 text-[11px] text-primary">
                      Lugares del mapa: {zone.place_refs.map((ref) => `[${ref}]`).join(", ")}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{zone.caveat}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              No hay una zona evaluada con datos suficientes. La falta de lugares en el mapa no demuestra que no existan negocios.
            </p>
          )}
        </section>
      </div>

      {(verdict.missing_information.length > 0 || verdict.next_steps.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {verdict.missing_information.length > 0 && (
            <section className="verdict-detail rounded-2xl p-4">
              <h5 className="font-semibold">Qué falta saber</h5>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
                {verdict.missing_information.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          )}
          {verdict.next_steps.length > 0 && (
            <section className="verdict-detail rounded-2xl p-4">
              <h5 className="font-semibold">Qué hacer ahora</h5>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-400">
                {verdict.next_steps.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </section>
          )}
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Es una recomendación basada en la información disponible, no una garantía de ventas ni de éxito. Confirma las cifras y visita las zonas antes de invertir.
      </p>
    </section>
  );
}

function linkify(content: string) {
  return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    const href = safeHref(part);
    return href ? (
      <a
        key={`${index}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-accent-cyan underline decoration-accent-cyan/40 underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    );
  });
}

function downloadMarkdown(title: string, sections: ReportSection[]) {
  const markdown = sections
    .map((section) => {
      if (!section.verdict) return `## ${section.title}\n\n${section.content}`;
      const verdict = section.verdict;
      const investment = verdict.investment
        ? `${moneyText(verdict.investment.minimum_mxn)}–${moneyText(verdict.investment.maximum_mxn)}\n\n${verdict.investment.basis}\n\nSupuestos: ${verdict.investment.assumptions.join("; ")}\n\nReferencias: ${verdict.investment.evidence_refs.map((ref) => `[${ref}]`).join(", ")}`
        : "No estimable responsablemente con los datos actuales.";
      const zones = verdict.zones.length
        ? verdict.zones
            .map((zone) =>
              `- **${zone.name}:** ${zone.reason} ${zone.caveat} Lugares: ${zone.place_refs.map((ref) => `[${ref}]`).join(", ")}`,
            )
            .join("\n")
        : "No hay zonas comparadas con información suficiente.";
      return [
        `## ${section.title}`,
        "",
        `**Recomendación:** ${VERDICT_META[verdict.recommendation].label}`,
        `**Confianza:** ${CONFIDENCE_LABELS[verdict.confidence]}`,
        "",
        verdict.summary,
        "",
        `### Inversión inicial\n\n${investment}`,
        `### Zonas para evaluar\n\n${zones}`,
        `### Qué falta saber\n\n${verdict.missing_information.map((item) => `- ${item}`).join("\n") || "Sin datos pendientes."}`,
        `### Qué hacer ahora\n\n${verdict.next_steps.map((item) => `- ${item}`).join("\n")}`,
      ].join("\n");
    })
    .join("\n\n");
  const blobUrl = URL.createObjectURL(
    new Blob([`# ${title}\n\n${markdown}\n`], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `${title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.md`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function moneyText(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}
