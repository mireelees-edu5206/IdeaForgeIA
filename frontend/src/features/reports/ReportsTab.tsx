import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiFileText,
  FiPrinter,
  FiRefreshCw,
} from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { useProjectOutlet } from "../projects/outlet";
import { PROVIDER_LABELS, safeHref } from "../research/constants";
import { useCreateReport, useReport, useReports } from "./queries";
import type { ReportStatus } from "./types";

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
  const reports = useReports(project.id);
  const createReport = useCreateReport(project.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reportId = selectedId ?? reports.data?.[0]?.id ?? null;
  const report = useReport(project.id, reportId);

  useEffect(() => {
    if (!selectedId && reports.data?.[0]) setSelectedId(reports.data[0].id);
  }, [reports.data, selectedId]);

  async function generateReport() {
    try {
      const created = await createReport.mutateAsync();
      setSelectedId(created.id);
    } catch {
      // createReport.error is displayed below.
    }
  }

  const generating = reports.data?.some((item) => item.status === "generating") ?? false;
  const canGenerate = project.status === "analyzed" && !generating && !createReport.isPending;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono-tech text-xs tracking-[0.2em] text-accent-cyan uppercase">
            Etapa 08 · Síntesis
          </p>
          <h2 className="font-display mt-1 text-2xl font-bold">Informes de validación</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Un documento versionado que conecta conclusiones, hallazgos, evidencia y fuentes.
            La interpretación de la IA se distingue de los datos y de lo que aún falta validar.
          </p>
        </div>
        <Button
          icon={<FiFileText aria-hidden="true" />}
          loading={createReport.isPending}
          disabled={!canGenerate}
          onClick={generateReport}
        >
          Generar informe
        </Button>
      </header>

      {project.status !== "analyzed" && (
        <Alert tone="info">
          Completa la investigación y el análisis del proyecto para generar un informe.
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
                    <span className="font-display font-semibold">Versión {item.version}</span>
                    <Badge className={status.className}>
                      <StatusIcon aria-hidden="true" />
                      {status.label}
                    </Badge>
                  </span>
                  <span className="mt-2 block text-xs text-slate-400">
                    {formatDateTime(item.created_at)}
                  </span>
                  {item.status === "completed" && (
                    <span className="mt-1 block text-xs text-slate-500">
                      {item.section_count} secciones
                    </span>
                  )}
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
          <h3 className="font-display text-lg font-semibold">Aún no hay informes</h3>
          <p className="max-w-md text-sm text-slate-400">
            Cuando el análisis esté listo, genera una versión para reunir lo aprendido y las
            preguntas pendientes en un solo documento.
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
          <p className="mt-1 text-xs text-slate-400">
            Versión {report.version} · {PROVIDER_LABELS[report.ai_provider]} · {report.ai_model}
          </p>
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
          La IA está organizando el informe a partir de la evidencia del proyecto…
        </div>
      ) : report.status === "failed" ? (
        <Alert>
          {REPORT_ERRORS[report.error_code ?? ""] ??
            "No se pudo completar este informe. Puedes generar una nueva versión."}
        </Alert>
      ) : (
        <div className="flex flex-col gap-5">
          {report.sections.map((section, index) => (
            <article
              key={section.id}
              className={index === 0 ? "border-l-2 border-accent-cyan pl-4" : ""}
            >
              <h4 className="font-display mb-2 text-lg font-semibold">{section.title}</h4>
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
                {linkify(section.content)}
              </p>
            </article>
          ))}
        </div>
      )}
    </GlassPanel>
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

function downloadMarkdown(title: string, sections: { title: string; content: string }[]) {
  const markdown = sections.map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n");
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
