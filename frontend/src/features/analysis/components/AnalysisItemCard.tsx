/**
 * ARCHIVO: analysis/components/AnalysisItemCard.tsx
 *
 * ¿Qué es?
 * Es la tarjeta de un elemento del análisis (una oportunidad, un riesgo, una suposición o una pregunta).
 * Muestra su texto, de dónde viene (IA o persona), su revisión, sus detalles según el tipo, los
 * resultados que lo respaldan y los botones para aceptar, rechazar, editar o borrar.
 *
 * ¿Para qué sirve?
 * Es donde la persona revisa cada sugerencia de la IA: lee las fuentes, decide si la acepta y,
 * si fue escrita por ella, la edita o la borra. Un elemento rechazado se ve tachado y apagado.
 *
 * ¿Quién la usa?
 * AnalysisTab.tsx, una tarjeta por elemento de cada sección.
 *
 * Qué cambia según el tipo (kind):
 * - Oportunidad: descripción y potencial.
 * - Riesgo: descripción, categoría, probabilidad, impacto y mitigación.
 * - Suposición: método, criterio de éxito, notas y un menú de estado de validación.
 * - Pregunta sin responder: importancia, prioridad y un menú de estado de resolución.
 */

/* "useState" guarda si la tarjeta está en modo edición. */
import { useState } from "react";
/* Iconos: palomita, lápiz, enlace externo, deshacer, basura y X. */
import { FiCheck, FiEdit2, FiExternalLink, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
/* Une clases de estilo y convierte errores a texto. */
import { cn } from "../../../lib/cn";
import { errorMessageFrom } from "../../../lib/formErrors";
/* Función que valida enlaces seguros (de la carpeta de investigación). */
import { safeHref } from "../../research/constants";
/* La ficha de resultado (para la evidencia). */
import type { Finding } from "../../findings/types";
/* Textos en español de atributos, niveles, prioridades y estados. */
import { ATTRIBUTE_LABELS, LEVEL_LABELS, PRIORITY_LABELS, RESOLUTION_STATUS_LABELS, RISK_CATEGORY_LABELS, VALIDATION_STATUS_LABELS } from "../constants";
/* Acciones de cambiar y borrar un elemento, desde la caché. */
import { useDeleteAnalysisItem, useUpdateAnalysisItem } from "../queries";
/* Tipos de cada elemento y de sus cambios. */
import type {
  AnalysisItem,
  AnalysisKindKey,
  AnalysisUpdate,
  FindingBrief,
  MissingInformation,
  Opportunity,
  ResolutionStatus,
  Risk,
  ValidationHypothesis,
  ValidationStatus,
} from "../types";
/* El formulario que se usa para editar el elemento. */
import { AnalysisItemForm } from "./AnalysisItemForm";

/**
 * VALIDATION_OPTIONS es la lista de estados de validación para el menú de una suposición.
 * Se arma a partir de VALIDATION_STATUS_LABELS: cada código con su texto.
 */
/** Define VALIDATION_OPTIONS para el bloque de analisis. */
const VALIDATION_OPTIONS = (Object.keys(VALIDATION_STATUS_LABELS) as ValidationStatus[]).map((value) => ({
  value,
  label: VALIDATION_STATUS_LABELS[value],
}));
/** RESOLUTION_OPTIONS es la lista de estados de resolución para el menú de una pregunta sin responder. */
/** Define RESOLUTION_OPTIONS para el bloque de analisis. */
const RESOLUTION_OPTIONS = (Object.keys(RESOLUTION_STATUS_LABELS) as ResolutionStatus[]).map((value) => ({
  value,
  label: RESOLUTION_STATUS_LABELS[value],
}));

/**
 * AnalysisItemCardProps describe lo que recibe la tarjeta:
 * - projectId: el proyecto.
 * - kind: el tipo del elemento (oportunidad, riesgo, suposición o pregunta).
 * - item: el elemento completo.
 * - findings: todos los resultados revisados del proyecto (para poder mostrar la evidencia).
 */
/** Contrato de datos AnalysisItemCardProps utilizado por analisis. */
interface AnalysisItemCardProps {
  projectId: string;
  kind: AnalysisKindKey;
  item: AnalysisItem;
  findings: Finding[];
}

/**
 * AnalysisItemCard dibuja la tarjeta de un elemento del análisis, o su formulario de edición.
 */
/** Expone la funcion analysis item card para el flujo de analysis. */
export function AnalysisItemCard({ projectId, kind, item, findings }: AnalysisItemCardProps) {
  // Las acciones de cambiar y borrar este elemento.
  const update = useUpdateAnalysisItem(projectId);
  const remove = useDeleteAnalysisItem(projectId);
  // "editing": si la tarjeta muestra el formulario de edición.
  const [editing, setEditing] = useState(false);
  // Identificador único del título, para lectores de pantalla.
  const headingId = `analysis-${item.id}`;
  // ¿Está rechazado? Si sí, se ve apagado y tachado.
  const rejected = item.review_status === "rejected";
  // Los resultados que respaldan este elemento (vienen dentro del propio elemento).
  const linkedFindings = item.findings;

  /**
   * save manda un cambio del elemento al servidor. Sirve tanto para editar como para cambiar
   * estados (aceptar, validar, resolver), porque todos son "cambios parciales".
   */
  /** Gestiona save de analisis. */
  async function save(data: AnalysisUpdate) {
    await update.mutateAsync({ kind, itemId: item.id, data });
  }

  // Modo edición: en lugar de la tarjeta, mostramos el formulario con los datos actuales.
  /** Rama condicional: editing. */
  if (editing) {
    return (
      <article aria-labelledby={headingId} className="surface-panel rounded-2xl p-5">
        <h3 id={headingId} className="mb-4 font-semibold">Editar análisis</h3>
        <AnalysisItemForm
          kind={kind}
          initial={item}
          findings={findings}
          pending={update.isPending}
          error={update.error}
          onSubmit={(submission) => {
            // Si la sumisión no es una edición (no trae itemId), no hacemos nada.
            /** Rama condicional: !("itemId" in submission). */
            if (!("itemId" in submission)) return Promise.resolve();
            return save(submission.data);
          }}
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
        />
      </article>
    );
  }

  // El título del elemento depende de su tipo: oportunidad y riesgo tienen "title",
  // suposición tiene "statement" y pregunta tiene "question".
  const title = "title" in item ? item.title : "statement" in item ? item.statement : (item as MissingInformation).question;
  return (
    // La tarjeta. "cn" la apaga si está rechazada.
    <article aria-labelledby={headingId} className={cn("surface-panel flex flex-col gap-3 rounded-2xl p-5", rejected && "opacity-60")}>
      {/* Las etiquetas: de dónde viene (IA o persona) y su revisión. */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Violeta si es de la IA, gris si es de la persona. */}
          <span className={cn("rounded-full px-2.5 py-1 text-xs ring-1", item.origin === "ai" ? "bg-violet-400/10 text-violet-200 ring-violet-300/25" : "bg-slate-400/10 text-slate-300 ring-slate-300/20")}>
            {item.origin === "ai" ? "Análisis de IA" : "Aportado por ti"}
          </span>
          {/* El estado de revisión en texto: "Sin revisar", "Aceptado" o "Rechazado". */}
          <span className="neo-inset rounded-full px-2.5 py-1 text-xs text-slate-300">{item.review_status === "proposed" ? "Sin revisar" : item.review_status === "accepted" ? "Aceptado" : "Rechazado"}</span>
        </div>
      </header>
      {/* El título del elemento. */}
      <h3 id={headingId} className={cn("font-semibold leading-relaxed text-slate-100", rejected && "line-through")}>{title}</h3>

      {/* Los detalles específicos del tipo. Cada línea solo se muestra si el tipo coincide. */}
      {kind === "opportunities" && <OpportunityDetails item={item as Opportunity} />}
      {kind === "risks" && <RiskDetails item={item as Risk} />}
      {/* En una suposición, el menú de estado de validación guarda el cambio al instante. */}
      {kind === "hypotheses" && <HypothesisDetails item={item as ValidationHypothesis} onChange={(validation_status) => void save({ validation_status })} pending={update.isPending} />}
      {/* En una pregunta, el menú de estado de resolución guarda el cambio al instante. */}
      {kind === "missing-information" && <MissingInformationDetails item={item as MissingInformation} onChange={(resolution_status) => void save({ resolution_status })} pending={update.isPending} />}

      {/* La evidencia: oportunidades y riesgos la muestran siempre. Suposiciones y preguntas, solo si tienen resultados vinculados. */}
      {(kind === "opportunities" || kind === "risks") && (
        <EvidenceLinks itemFindings={linkedFindings} allFindings={findings} fromAi={item.origin === "ai"} />
      )}
      {(kind === "hypotheses" || kind === "missing-information") && linkedFindings.length > 0 && (
        <EvidenceLinks itemFindings={linkedFindings} allFindings={findings} fromAi={item.origin === "ai"} />
      )}

      {/* Errores de cambiar o borrar. "??" toma el de cambiar; si no hay, el de borrar. */}
      {(update.isError || remove.isError) && <Alert>{errorMessageFrom(update.error ?? remove.error)}</Alert>}
      {/* Los botones. Aceptar, rechazar y deshacer aplican solo a elementos de la IA. */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        {item.origin === "ai" && item.review_status !== "accepted" && (
          <Button size="sm" variant="secondary" disabled={update.isPending} icon={<FiCheck aria-hidden="true" />} onClick={() => void save({ review_status: "accepted" })}>Aceptar</Button>
        )}
        {item.origin === "ai" && item.review_status !== "rejected" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiX aria-hidden="true" />} onClick={() => void save({ review_status: "rejected" })}>Rechazar</Button>
        )}
        {item.origin === "ai" && item.review_status !== "proposed" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiRotateCcw aria-hidden="true" />} onClick={() => void save({ review_status: "proposed" })}>Deshacer revisión</Button>
        )}
        {/* Editar: siempre disponible. Tiene solo icono, por eso lleva "aria-label". */}
        <Button size="icon" variant="ghost" aria-label="Editar análisis" onClick={() => setEditing(true)}><FiEdit2 aria-hidden="true" /></Button>
        {/* Borrar: solo para elementos que escribió la persona. Si falla, el error ya se muestra arriba. */}
        {item.origin === "user" && (
          <Button size="icon" variant="ghost" aria-label="Eliminar análisis" className="hover:text-rose-300" onClick={() => void remove.mutateAsync({ kind, itemId: item.id }).catch(() => undefined)}>
            <FiTrash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </article>
  );
}

/**
 * OpportunityDetails muestra la descripción de una oportunidad y su potencial estimado.
 * Recibe: item (la oportunidad).
 */
/** Componente OpportunityDetails: renderiza la vista de analisis. */
function OpportunityDetails({ item }: { item: Opportunity }) {
  return (
    <>
      <p className="text-sm leading-relaxed text-slate-300">{item.description}</p>
      <p className="text-xs text-slate-400">Potencial estimado: <span className="text-slate-200">{LEVEL_LABELS[item.potential]}</span></p>
    </>
  );
}

/**
 * RiskDetails muestra la descripción de un riesgo, su categoría, su probabilidad e impacto,
 * y la mitigación posible (solo si existe).
 * Recibe: item (el riesgo).
 */
/** Componente RiskDetails: renderiza la vista de analisis. */
function RiskDetails({ item }: { item: Risk }) {
  return (
    <>
      <p className="text-sm leading-relaxed text-slate-300">{item.description}</p>
      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="neo-inset rounded-full px-2.5 py-1">{RISK_CATEGORY_LABELS[item.category]}</span>
        <span className="neo-inset rounded-full px-2.5 py-1">Probabilidad: {LEVEL_LABELS[item.likelihood]}</span>
        <span className="neo-inset rounded-full px-2.5 py-1">Impacto: {LEVEL_LABELS[item.impact]}</span>
      </div>
      {item.mitigation && <p className="text-sm text-slate-300"><span className="font-medium text-slate-200">Mitigación posible: </span>{item.mitigation}</p>}
    </>
  );
}

/**
 * HypothesisDetails muestra una suposición: prioridad, atributo, cómo comprobarla, criterio de éxito,
 * notas y un menú para cambiar su estado de validación.
 * Recibe:
 * - item: la suposición.
 * - onChange: qué hacer cuando la persona elige otro estado.
 * - pending: true mientras se guarda (bloquea el menú).
 */
/** Componente HypothesisDetails: renderiza la vista de analisis. */
function HypothesisDetails({ item, onChange, pending }: { item: ValidationHypothesis; onChange: (value: ValidationHypothesis["validation_status"]) => void; pending: boolean }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-300">
      <div className="grid gap-3 sm:grid-cols-2">
        <p>Prioridad: <span className="text-slate-100">{PRIORITY_LABELS[item.priority]}</span></p>
        {/* El atributo solo aparece si la suposición está vinculada a una parte de la idea. */}
        {item.related_attribute && <p>Atributo: <span className="text-slate-100">{ATTRIBUTE_LABELS[item.related_attribute]}</span></p>}
      </div>
      {item.validation_method && <p><span className="font-medium text-slate-200">Cómo validarla: </span>{item.validation_method}</p>}
      {item.success_criteria && <p><span className="font-medium text-slate-200">Criterio de éxito: </span>{item.success_criteria}</p>}
      {item.result_notes && <p><span className="font-medium text-slate-200">Notas del resultado: </span>{item.result_notes}</p>}
      <Select label="Estado de validación" value={item.validation_status} options={VALIDATION_OPTIONS} onChange={onChange} disabled={pending} />
    </div>
  );
}

/**
 * MissingInformationDetails muestra una pregunta sin responder: su importancia, prioridad, atributo,
 * notas y un menú para cambiar su estado de resolución.
 * Recibe:
 * - item: la pregunta.
 * - onChange: qué hacer cuando la persona elige otro estado.
 * - pending: true mientras se guarda (bloquea el menú).
 */
/** Componente MissingInformationDetails: renderiza la vista de analisis. */
function MissingInformationDetails({ item, onChange, pending }: { item: MissingInformation; onChange: (value: MissingInformation["resolution_status"]) => void; pending: boolean }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-300">
      {item.reason && <p><span className="font-medium text-slate-200">Importancia / siguiente paso sugerido: </span>{item.reason}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* La prioridad y, si existe, el atributo separados por " · ". */}
        <span>Prioridad: {PRIORITY_LABELS[item.priority]}{item.related_attribute ? ` · ${ATTRIBUTE_LABELS[item.related_attribute]}` : ""}</span>
        <Select label="Estado" value={item.resolution_status} options={RESOLUTION_OPTIONS} onChange={onChange} disabled={pending} className="w-full sm:min-w-40" />
      </div>
      {item.resolution_notes && <p><span className="font-medium text-slate-200">Notas: </span>{item.resolution_notes}</p>}
    </div>
  );
}

/**
 * EvidenceLinks muestra los resultados que respaldan un elemento, con sus citas y enlaces a las fuentes.
 * Si el elemento viene de la IA, avisa que hay que revisar las fuentes antes de aceptarlo.
 *
 * Recibe:
 * - itemFindings: los resultados vinculados (fichas cortas).
 * - allFindings: todos los resultados completos, para buscar sus citas y fuentes.
 * - fromAi: true si el elemento es de la IA.
 */
/** Componente EvidenceLinks: renderiza la vista de analisis. */
function EvidenceLinks({ itemFindings, allFindings, fromAi }: { itemFindings: FindingBrief[]; allFindings: Finding[]; fromAi: boolean }) {
  return (
    <section className="neo-inset rounded-xl p-3" aria-label="Fuentes relacionadas">
      <p className="mb-2 text-xs font-semibold text-slate-300">
        {fromAi ? "Sugerencia de IA · revisa las fuentes antes de aceptarla" : "Resultados relacionados"}
      </p>
      {itemFindings.length === 0 ? (
        <p className="text-xs text-amber-200">Todavía no hay resultados relacionados para comprobar esta sugerencia.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itemFindings.map((brief) => {
            // Buscamos el resultado completo (con sus citas) usando su id. Puede no estar si no se cargó.
            const finding = allFindings.find((candidate) => candidate.id === brief.id);
            return (
              <li key={brief.id} className="border-l-2 border-accent-cyan/30 pl-3">
                <p className="text-sm text-slate-200">{brief.statement}</p>
                {/* Las citas, solo si el resultado completo tiene evidencia. */}
                {finding?.evidence.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {finding.evidence.map((evidence) => {
                      // Dirección segura de la fuente, o null si no lo es.
                      const href = safeHref(evidence.source.url);
                      return (
                        <li key={evidence.evidence_id} className="text-xs text-slate-400">
                          <blockquote>«{evidence.content}»</blockquote>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 hover:text-accent-cyan hover:underline">
                              {evidence.source.title ?? evidence.source.domain} · {evidence.source.domain}
                              <FiExternalLink aria-hidden="true" className="size-3" />
                              <span className="sr-only">(se abre en una pestaña nueva)</span>
                            </a>
                          ) : <span>{evidence.source.domain}</span>}
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="mt-1 text-xs text-slate-500">Este resultado aún no tiene una fuente externa asociada.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
