/**
 * ARCHIVO: reports/ReportsTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Veredicto final". Aquí la persona pide un informe (el veredicto), elige zonas
 * para evaluar, ve el informe cuando está listo y puede descargarlo en Markdown o imprimirlo como PDF.
 *
 * ¿Para qué sirve?
 * Convierte todo lo investigado y analizado en una recomendación: probar la idea en pequeño, validar
 * más, no avanzar todavía, o declarar que faltan datos. Siempre aclara que NO es una garantía de éxito.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "reportes").
 *
 * Qué ve la persona:
 * - Un botón "Generar veredicto". Solo se activa si el proyecto está analizado, no hay un informe
 *   generándose y hay como máximo 3 zonas.
 * - Un cuadro para escribir las zonas (una por línea). Puede llegar prellenado desde el mapa
 *   (parámetros de la dirección) o desde las zonas confirmadas de la idea.
 * - La lista de versiones del informe (la más nueva primero).
 * - El documento: el veredicto con inversión y zonas, y debajo el análisis completo plegado.
 *
 * Flujo de generación: al pulsar el botón, se manda la lista de zonas al servidor. El informe aparece
 * como "Generando" y esta pantalla lo vuelve a pedir cada 2 segundos hasta que esté listo o falle.
 */
/** Solicita y presenta el veredicto y el informe. */

/* "useEffect" hace algo al cambiar datos. "useState" guarda la versión elegida y el texto de zonas. */
import { useEffect, useState } from "react";
/* "useSearchParams" lee lo que viene en la dirección después del "?" (zona, lat, lon, radio y giro). */
import { useSearchParams } from "react-router";
/* Iconos: alerta, palomita, reloj, descarga, documento, pin de mapa, impresora y recargar. */
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

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
import { TextArea } from "../../components/ui/TextArea";
/* Formato de fecha y convertidor de errores a texto. */
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
/* El proyecto que entregó el detalle a esta pestaña. */
import { useProjectOutlet } from "../projects/outlet";
/* Función que valida enlaces seguros (carpeta de investigación). */
import { safeHref } from "../research/constants";
/* Las consultas y la acción de crear, desde la caché. */
import { useCreateReport, useReport, useReports } from "./queries";
/* Tipos del veredicto, de las zonas, de los apartados y del estado. */
import type { BusinessVerdict, GeographicScopeInput, ReportSection, ReportStatus } from "./types";

/**
 * REPORT_STATUS asigna a cada estado de informe su texto, sus colores y su icono:
 * - generating: "Generando" (ámbar, reloj).
 * - completed: "Listo" (verde, palomita).
 * - failed: "Fallido" (rosa, alerta).
 * Cambia aquí los textos o colores de las etiquetas de estado.
 */
/** Catalogo REPORT_STATUS que define etiquetas o reglas de informes. */
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

/**
 * REPORT_ERRORS traduce los códigos de error del servidor a mensajes en español. Se busca con
 * REPORT_ERRORS[codigo]. Si el código no está aquí, se usa un mensaje general (ver ReportDocument).
 * Por ejemplo, "ai_timeout" significa que la IA tardó demasiado.
 */
/** Define REPORT_ERRORS para el bloque de informes. */
const REPORT_ERRORS: Record<string, string> = {
  ai_timeout: "La IA tardó demasiado en preparar el informe. Puedes generar otro.",
  ai_rate_limited: "La IA alcanzó su límite temporal. Inténtalo de nuevo más tarde.",
  ai_unavailable: "La IA no está disponible ahora. Tus datos siguen guardados.",
  ai_invalid_response: "La IA no devolvió un informe con el formato esperado.",
  report_generation_failed: "No se pudo completar el informe. Puedes volver a intentarlo.",
};

/**
 * ReportsTab dibuja la pestaña completa: el botón de generar, la zona, la lista de versiones y el documento.
 */
/** Expone la funcion reports tab para el flujo de reports. */
export function ReportsTab() {
  // El proyecto que entregó el detalle.
  const { project } = useProjectOutlet();
  // Los parámetros de la dirección (lo que viene después del "?"). Solo se leen, no se cambian.
  const [searchParams] = useSearchParams();
  // La lista de informes del proyecto.
  const reports = useReports(project.id);
  // La acción de generar un informe nuevo.
  const createReport = useCreateReport(project.id);
  // La versión que eligió la persona. "null" significa que no eligió ninguna.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // La versión que se muestra: la elegida, o la más reciente si no eligió ninguna.
  // "??" elige la primera opción que exista; si no hay informes, el valor es null.
  const reportId = selectedId ?? reports.data?.[0]?.id ?? null;
  // El informe completo (con sus apartados) de la versión que se muestra.
  const report = useReport(project.id, reportId);
  // El texto del cuadro de zonas. Empieza con la zona del mapa (si viene en la dirección),
  // o con las zonas confirmadas de la idea, unidas con saltos de línea.
  const [geographicScopeText, setGeographicScopeText] = useState(() =>
    searchParams.get("zona")?.trim() ||
      project.attributes
        .filter((attribute) => attribute.attribute_type === "geographic_scope" && attribute.is_confirmed)
        .map((attribute) => attribute.value)
      .join("\n"),
  );
  // Cuántas zonas hay escritas: se cuentan las líneas que no están vacías.
  // "split(/\r?\n/)" separa por saltos de línea (acepta los de Windows y los normales).
  const geographicScopeCount = geographicScopeText.split(/\r?\n/).filter((scope) => scope.trim()).length;

  // Si todavía no hay versión elegida y ya llegó la lista, elegimos la primera (la más reciente).
  useEffect(() => {
    // Rama: solo si no hay nada elegido y la lista ya tiene un informe.
    /** Rama condicional: !selectedId && reports.data?.[0]. */
    if (!selectedId && reports.data?.[0]) setSelectedId(reports.data[0].id);
  }, [reports.data, selectedId]);

  /**
   * generateReport arma la lista de zonas y pide el informe. Hace esto:
   * 1. Toma cada línea del cuadro, quita espacios y las vacías. Solo usa las 3 primeras.
   * 2. Para cada zona, si la dirección trae coordenadas del mapa Y el texto de la zona sigue
   *    siendo el mismo que vino del mapa, añade latitud, longitud, radio y giro. Si no, manda solo el nombre.
   * 3. Pide crear el informe y muestra la versión nueva.
   * Si algo falla, el error lo muestra createReport.error más abajo.
   */
  /** Gestiona generate report de informes. */
  async function generateReport() {
    // Protegemos la petición: si algo sale mal, el error queda en createReport.error.
    /** Maneja fallos de la operacion del bloque informes. */
    try {
      const geographicScopes = geographicScopeText
        .split(/\r?\n/)
        .map((scope) => scope.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((query): GeographicScopeInput => {
          // Reutiliza coordenadas del mapa solo si el texto de la zona sigue coincidiendo.
          // "zona" es el nombre que trajo el mapa; si la persona lo cambió, ya no coincide y no se usan las coordenadas.
          const selectedArea = searchParams.get("zona")?.trim();
          // Los textos de latitud y longitud. "null" significa que no venían en la dirección.
          const latitudeText = searchParams.get("lat");
          const longitudeText = searchParams.get("lon");
          // Los convertimos a número. Ojo: Number(null) da 0, por eso antes revisamos que el texto no sea null.
          const latitude = Number(latitudeText);
          const longitude = Number(longitudeText);
          // El radio viene del mapa en metros. Si no es un número, luego se usa 1000.
          const radius = Number(searchParams.get("radio"));
          // El giro (tipo de negocio). Si está vacío, no se manda.
          const keyword = searchParams.get("giro")?.trim();
          // Solo usamos las coordenadas si: la zona coincide, ambos valores existen, son números válidos,
          // la latitud está entre -90 y 90 y la longitud entre -180 y 180.
          /** Rama condicional: selectedArea === query && latitudeText !== null && long. */
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
              // El radio solo se usa si está entre 100 y 5000 metros; si no, se usa 1000.
              radius_m: Number.isFinite(radius) && radius >= 100 && radius <= 5000 ? radius : 1000,
              // "...(keyword ? { keyword } : {})" agrega el giro solo si existe.
              ...(keyword ? { keyword } : {}),
            };
          }
          // Sin coordenadas válidas: solo se manda el nombre de la zona.
          return { query };
        });
      const created = await createReport.mutateAsync(geographicScopes);
      // Mostramos de inmediato el informe recién creado.
      setSelectedId(created.id);
    } catch {
      // createReport.error is displayed below.
    }
  }

  // ¿Hay algún informe generándose ahora? Si sí, no se permite crear otro.
  // "?? false" usa false si la lista todavía no cargó.
  const generating = reports.data?.some((item) => item.status === "generating") ?? false;
  // El botón "Generar veredicto" solo se activa si: el proyecto está analizado, no hay un informe
  // generándose, no se está enviando otro ahora, y hay como máximo 3 zonas.
  const canGenerate =
    project.status === "analyzed" &&
    !generating &&
    !createReport.isPending &&
    geographicScopeCount <= 3;

  return (
    <div className="flex flex-col gap-5">
      {/* La cabecera: título, aviso de que no es garantía y el botón de generar. */}
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

      {/* El cuadro para escribir las zonas. El salto de línea dentro del ejemplo (placeholder) muestra dos líneas de ejemplo. */}
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
      {/* Aviso si hay más de 3 zonas. El botón de generar ya está desactivado en ese caso. */}
      {geographicScopeCount > 3 && (
        <Alert tone="info">Elige hasta tres zonas para comparar en este veredicto.</Alert>
      )}

      {/* Aviso si el proyecto todavía no llegó a "analizado". */}
      {project.status !== "analyzed" && (
        <Alert tone="info">
          Completa la investigación y el análisis para preparar el veredicto.
        </Alert>
      )}
      {/* El error de crear el informe, si lo hubo. */}
      {createReport.isError && <Alert>{errorMessageFrom(createReport.error)}</Alert>}
      {/* Si falló cargar la lista, el error y un botón (icono) para reintentar. */}
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

      {/* El cuerpo: cargando la lista, la lista con el documento, o el mensaje de "aún no está listo". */}
      {reports.isPending ? (
        <div role="status" className="flex items-center gap-3 py-10 text-slate-300">
          <Spinner className="size-5 text-accent-cyan" />
          Cargando informes…
        </div>
      ) : reports.data?.length ? (
        // Dos columnas en pantallas grandes: la lista de versiones a la izquierda y el documento a la derecha.
        <div className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)]">
          {/* La lista de versiones. En pantallas chicas se desplaza de lado. */}
          <nav aria-label="Versiones del informe" className="flex gap-2 overflow-x-auto xl:flex-col">
            {reports.data.map((item) => {
              // La etiqueta y el icono de su estado.
              const status = REPORT_STATUS[item.status];
              const StatusIcon = status.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  // "aria-current" marca la versión que se está viendo, para lectores de pantalla.
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

          {/* El documento de la versión elegida. Recibe los datos del informe, si está cargando y el error. */}
          <ReportDocument report={report.data} isPending={report.isPending} error={report.error} />
        </div>
      ) : (
        // No hay informes todavía: un mensaje de orientación.
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

/**
 * ReportDocument dibuja el documento de un informe, o su estado: cargando, error, generando o fallido.
 *
 * Recibe:
 * - report: el informe completo (o undefined si no llegó todavía).
 * - isPending: true mientras se carga.
 * - error: el error de cargarlo, o null.
 *
 * Cuando está listo, muestra el título, el estado, los botones "Descargar .md" e "Imprimir / PDF"
 * (estos botones NO aparecen al imprimir, gracias a "print:hidden"), y el contenido.
 */
/** Componente ReportDocument: renderiza la vista de informes. */
function ReportDocument({
  report,
  isPending,
  error,
}: {
  // El tipo que devuelve useReport para el campo "data" (un informe completo o undefined).
  report: ReturnType<typeof useReport>["data"];
  isPending: boolean;
  error: unknown;
}) {
  // Caso 1: cargando. Mostramos la ruedita.
  /** Rama condicional: isPending. */
  if (isPending) {
    return (
      <GlassPanel role="status" className="flex min-h-56 items-center justify-center gap-3 p-8">
        <Spinner className="size-5 text-accent-cyan" />
        Preparando el documento…
      </GlassPanel>
    );
  }
  // Caso 2: hubo error al cargar. Mostramos el motivo.
  /** Rama condicional: error. */
  if (error) return <Alert>{errorMessageFrom(error)}</Alert>;
  // Caso 3: no hay informe que mostrar. No dibujamos nada.
  /** Rama condicional: !report. */
  if (!report) return null;

  // La etiqueta del estado del informe, y si ya está completo (para mostrar los botones de descargar e imprimir).
  const status = REPORT_STATUS[report.status];
  const StatusIcon = status.icon;
  const complete = report.status === "completed";

  return (
    // El documento. El id "report-print" permite que solo se imprima esta parte.
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
        {/* Los botones de descargar e imprimir solo aparecen cuando el informe está listo. */}
        {complete && (
          <div className="flex gap-2 print:hidden">
            {/* Descarga el informe como archivo Markdown (.md). */}
            <Button
              variant="secondary"
              size="sm"
              icon={<FiDownload aria-hidden="true" />}
              onClick={() => downloadMarkdown(report.title, report.sections)}
            >
              Descargar .md
            </Button>
            {/* Abre el diálogo de impresión del navegador. Desde ahí se puede guardar como PDF. */}
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

      {/* El contenido según el estado: generando, fallido o listo. */}
      {report.status === "generating" ? (
        <div role="status" className="flex items-center gap-3 py-8 text-slate-300">
          <span className="size-2 animate-pulse rounded-full bg-accent-cyan" />
          Revisando la información del proyecto para preparar una recomendación…
        </div>
      ) : report.status === "failed" ? (
        // Fallido: buscamos el mensaje del código de error. Si no existe, usamos un mensaje general.
        // "??" usa el texto de la derecha si el de la izquierda es null o undefined.
        <Alert>
          {REPORT_ERRORS[report.error_code ?? ""] ??
            "No se pudo completar este informe. Puedes generar una nueva versión."}
        </Alert>
      ) : (
        <>
          {/* Si la IA usada es la de demostración ("fake"), avisamos que no es una evaluación real. */}
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

/**
 * ReportSections decide cómo se acomodan los apartados. Hay dos formas:
 * 1. Con veredicto: se muestra la tarjeta del veredicto y, debajo, el análisis completo plegado.
 * 2. Sin veredicto (informes antiguos o sin esa parte): se muestra el resumen ejecutivo y,
 *    debajo, el resto plegado.
 *
 * "details" y "summary" crean un bloque que se abre y se cierra al tocarlo, sin código extra.
 */
/** Componente ReportSections: renderiza la vista de informes. */
function ReportSections({ sections }: { sections: ReportSection[] }) {
  // El apartado que trae el veredicto estructurado (puede no existir).
  const verdictSection = sections.find((section) => section.verdict);
  // Los demás apartados, sin el de veredicto.
  const detailSections = sections.filter((section) => section.id !== verdictSection?.id);

  // Forma 2: no hay veredicto. Usamos el resumen ejecutivo como principal.
  /** Rama condicional: !verdictSection?.verdict. */
  if (!verdictSection?.verdict) {
    // El resumen ejecutivo, y el resto de los apartados sin él.
    const summary = sections.find((section) => section.section_type === "executive_summary");
    const details = sections.filter((section) => section.id !== summary?.id);
    return (
      <>
        {summary && <ReportArticle section={summary} />}
        {/* El resto de apartados solo aparece si existen. Se muestran plegados. */}
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

  // Forma 1: hay veredicto. Primero la tarjeta, luego el análisis completo plegado.
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

/**
 * ReportArticle dibuja un apartado: su título y su texto. Los enlaces dentro del texto se
 * vuelven clicables gracias a linkify. El texto conserva sus saltos de línea ("pre-wrap").
 *
 * Recibe: section (el apartado).
 */
/** Componente ReportArticle: renderiza la vista de informes. */
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

/**
 * VERDICT_META asigna a cada recomendación su texto y colores. Es la lista de las cuatro posibles:
 * - worth_testing: "Vale la pena probarla en pequeño" (verde).
 * - needs_validation: "Faltan pruebas importantes" (ámbar).
 * - do_not_proceed_yet: "No conviene avanzar todavía" (rosa).
 * - insufficient_information: "Aún no hay datos suficientes" (gris).
 */
/** Catalogo VERDICT_META que define etiquetas o reglas de informes. */
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

/**
 * CONFIDENCE_LABELS traduce el nivel de confianza del veredicto: "low" → "Baja", "medium" → "Media", "high" → "Alta".
 */
/** Catalogo CONFIDENCE_LABELS que define etiquetas o reglas de informes. */
const CONFIDENCE_LABELS: Record<BusinessVerdict["confidence"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

/**
 * VerdictCard dibuja la tarjeta principal del veredicto: la recomendación, la confianza, el resumen,
 * la inversión inicial, las zonas evaluadas, lo que falta saber y los siguientes pasos.
 *
 * Recibe:
 * - verdict: el veredicto estructurado.
 * - summary: el texto del apartado de veredicto (se muestra como resumen).
 *
 * Detalle de la inversión: si no hay cifra, se muestra un mensaje que dice que no se inventó una.
 * Las cifras se formatean como pesos mexicanos sin centavos (por ejemplo "$12,000").
 */
/** Componente VerdictCard: renderiza la vista de informes. */
function VerdictCard({ verdict, summary }: { verdict: BusinessVerdict; summary: string }) {
  // El texto y color de la recomendación.
  const recommendation = VERDICT_META[verdict.recommendation];
  // La inversión estimada, o null si no hay.
  const investment = verdict.investment;
  // Formateador de dinero: pesos mexicanos (MXN), sin decimales.
  const money = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

  return (
    // La tarjeta del veredicto. El id "veredicto-final" sirve para lectores de pantalla.
    <section aria-labelledby="veredicto-final" className="verdict-card rounded-3xl p-5 sm:p-7">
      {/* Las dos etiquetas: la recomendación y la confianza (en minúsculas: "Confianza alta"). */}
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

      {/* Dos cuadros lado a lado en pantallas medianas: la inversión y las zonas. */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <section className="verdict-detail rounded-2xl p-4">
          <h5 className="font-semibold">Inversión inicial</h5>
          {investment ? (
            <>
              {/* El rango de inversión, por ejemplo "$10,000–$20,000". */}
              <p className="mt-2 font-display text-xl font-bold">
                {money.format(investment.minimum_mxn)}–{money.format(investment.maximum_mxn)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{investment.basis}</p>
              {/* Los supuestos, solo si hay alguno. */}
              {investment.assumptions.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
                  {investment.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                </ul>
              )}
              {/* Las referencias a resultados, por ejemplo "[E1], [E3]". Solo si existen. */}
              {investment.evidence_refs.length > 0 && (
                <p className="mt-2 text-[11px] text-primary">
                  Basado en resultados: {investment.evidence_refs.map((ref) => `[${ref}]`).join(", ")}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">Rango orientativo; confirma costos con proveedores locales.</p>
            </>
          ) : (
            // Sin cifra: se explica por qué. No se inventa un número.
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
                // La clave combina el nombre y la razón, para que sea única.
                <li key={`${zone.name}-${zone.reason}`} className="text-sm">
                  <p className="font-medium">{zone.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{zone.reason}</p>
                  {/* Los lugares del mapa que la respaldan, si hay. */}
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
            // Sin zonas evaluadas: se explica que la falta de lugares en el mapa no prueba que no existan negocios.
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              No hay una zona evaluada con datos suficientes. La falta de lugares en el mapa no demuestra que no existan negocios.
            </p>
          )}
        </section>
      </div>

      {/* Lo que falta saber y los siguientes pasos, solo si hay alguno de los dos. */}
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
              {/* "ol" es una lista numerada: los pasos van en orden. */}
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-400">
                {verdict.next_steps.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </section>
          )}
        </div>
      )}
      {/* El descargo de responsabilidad: no es garantía de ventas ni de éxito. */}
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Es una recomendación basada en la información disponible, no una garantía de ventas ni de éxito. Confirma las cifras y visita las zonas antes de invertir.
      </p>
    </section>
  );
}

/**
 * linkify convierte las direcciones web que aparecen en un texto en enlaces clicables.
 *
 * Cómo funciona:
 * 1. "split" corta el texto en partes; las direcciones (que empiezan con http:// o https://) quedan
 *    como partes separadas, porque el paréntesis del patrón las conserva.
 * 2. Para cada parte, safeHref revisa que sea una dirección segura. Si sí, se muestra como enlace
 *    (en pestaña nueva). Si no, se muestra como texto normal.
 */
/** Gestiona linkify de informes. */
function linkify(content: string) {
  return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    // Dirección segura de esta parte, o undefined si no es una dirección válida.
    const href = safeHref(part);
    return href ? (
      <a
        // La clave combina el número de la parte con la dirección, para que sea única.
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

/**
 * downloadMarkdown arma un archivo Markdown (.md) con todo el informe y lo descarga.
 *
 * Pasos:
 * 1. Convierte cada apartado en texto Markdown. Los apartados de veredicto tienen una forma especial
 *    (recomendación, confianza, inversión, zonas, faltantes y siguientes pasos).
 * 2. Une todo y crea un archivo en memoria (Blob) con el título arriba.
 * 3. Crea un enlace invisible con ese archivo, le pone un nombre tomado del título (sin acentos ni
 *    espacios) y hace clic en él para descargarlo.
 * 4. Un segundo después libera la memoria del archivo (revokeObjectURL).
 */
/** Gestiona download markdown de informes. */
function downloadMarkdown(title: string, sections: ReportSection[]) {
  const markdown = sections
    .map((section) => {
      // Apartado normal: título y texto tal cual.
      /** Rama condicional: !section.verdict. */
      if (!section.verdict) return `## ${section.title}\n\n${section.content}`;
      // Apartado de veredicto: lo armamos por partes.
      const verdict = section.verdict;
      // La inversión, o el aviso de que no se puede estimar.
      const investment = verdict.investment
        ? `${moneyText(verdict.investment.minimum_mxn)}–${moneyText(verdict.investment.maximum_mxn)}\n\n${verdict.investment.basis}\n\nSupuestos: ${verdict.investment.assumptions.join("; ")}\n\nReferencias: ${verdict.investment.evidence_refs.map((ref) => `[${ref}]`).join(", ")}`
        : "No estimable responsablemente con los datos actuales.";
      // Las zonas, como lista con guiones, o un aviso si no hay.
      const zones = verdict.zones.length
        ? verdict.zones
            .map((zone) =>
              `- **${zone.name}:** ${zone.reason} ${zone.caveat} Lugares: ${zone.place_refs.map((ref) => `[${ref}]`).join(", ")}`,
            )
            .join("\n")
        : "No hay zonas comparadas con información suficiente.";
      // Las líneas del apartado, unidas con saltos de línea.
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
    // Separamos los apartados con una línea en blanco.
    .join("\n\n");
  // Creamos el archivo en memoria con el título arriba. "text/markdown" indica el tipo.
  const blobUrl = URL.createObjectURL(
    new Blob([`# ${title}\n\n${markdown}\n`], { type: "text/markdown;charset=utf-8" }),
  );
  // Creamos un enlace invisible apuntando al archivo.
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  // El nombre del archivo: el título sin acentos, en minúsculas, con guiones en lugar de espacios y signos.
  // Por ejemplo "Agro Conecta" se vuelve "agro-conecta.md".
  anchor.download = `${title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.md`;
  // Hacemos clic para iniciar la descarga.
  anchor.click();
  // Liberamos la memoria un segundo después, para dar tiempo a que empiece la descarga.
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

/**
 * moneyText formatea un número como pesos mexicanos sin centavos (por ejemplo, 12000 → "$12,000").
 * Lo usa downloadMarkdown, porque ahí no se puede usar el formateador de VerdictCard.
 */
/** Gestiona money text de informes. */
function moneyText(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}
