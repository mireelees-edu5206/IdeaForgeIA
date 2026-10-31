/**
 * ARCHIVO: projects/components/StructurePanel.tsx
 *
 * ¿Qué es?
 * Es el panel "Antes de investigar". Muestra los tres datos básicos que la idea necesita
 * (problema, solución y cliente), marca cuáles ya están listos y cuáles faltan, y tiene el botón
 * para confirmar la estructura y pasar a la investigación.
 *
 * ¿Para qué sirve?
 * Es el guardián de la investigación: no deja buscar en internet hasta que la idea tenga lo mínimo.
 * Así evita investigar una idea mal definida y gastar búsquedas en vano.
 *
 * ¿Quién lo usa?
 * ProjectIdeaTab.tsx (la pestaña de la idea, dentro del detalle del proyecto) lo muestra.
 *
 * Qué ve la persona según el estado:
 * - Borrador con datos incompletos: la lista de los tres datos y el botón "Guardar y continuar" apagado.
 * - Borrador con los tres datos: el botón se enciende.
 * - Lista para investigar: aviso verde y el botón "Buscar información en internet".
 * - Ya investigada (o analizada): aviso ámbar que dice que, si la edita, se pedirá confirmar otra vez.
 */

/* Iconos: capas (el panel), círculo con palomita (listo), círculo vacío (falta), alerta, brújula (ver investigación). */
import { FiAlertCircle, FiCheckCircle, FiCircle, FiCompass, FiLayers } from "react-icons/fi";
/* Permite cambiar de página después de algo. */
import { useNavigate } from "react-router";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { FacetTriadGlyph } from "../../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { LinkButton } from "../../../components/ui/LinkButton";
/* "ApiError" es el error del servidor con un código. "errorMessageFrom" lo convierte en texto. */
import { ApiError } from "../../../lib/apiClient";
import { errorMessageFrom } from "../../../lib/formErrors";
/* El botón que inicia la investigación en internet. */
import { StartResearchButton } from "../../research/components/StartResearchButton";
/* Textos de cada atributo y lista de los tres obligatorios. */
import { ATTRIBUTE_META, REQUIRED_ATTRIBUTES } from "../constants";
/* La acción que confirma la estructura. */
import { useConfirmStructure } from "../queries";
/* Forma del proyecto completo. */
import type { ProjectDetail } from "../types";
/* Las etiquetas de origen (dato del usuario o sugerencia de IA). */
import { OriginBadge } from "./badges";

/**
 * StructurePanel recibe el proyecto completo y dibuja el panel según su estado.
 *
 * Recibe: project (el proyecto con su lista de atributos y su revisión de estructura).
 */
/** Explica atributos requeridos y faltantes. */
export function StructurePanel({ project }: { project: ProjectDetail }) {
  // Para llevar a la persona a la investigación al empezar.
  const navigate = useNavigate();
  // La acción de confirmar la estructura de este proyecto.
  const confirmStructure = useConfirmStructure(project.id);
  // Lo que devuelve la revisión de la idea (qué falta, si está lista) y el estado actual del proyecto.
  const { structure, status } = project;
  // Se puede editar solo si está en borrador o lista. Si ya se investigó, no (sin avisar).
  const editable = status === "draft" || status === "structured";
  // El error de confirmar. Si el error es "estructura incompleta", no lo mostramos aquí: la lista de faltantes ya lo explica.
  const confirmError =
    confirmStructure.error instanceof ApiError && confirmStructure.error.code === "structure_incomplete"
      ? null
      : confirmStructure.error;

  // Cuántos de los tres datos obligatorios ya están listos: el total menos los que faltan.
  const litFacets = REQUIRED_ATTRIBUTES.length - structure.missing.length;

  return (
    <GlassPanel className="stage-3d flex flex-col gap-5 rounded-3xl p-5">
      {/* El encabezado: icono y título a la izquierda, las tres caras de cristal a la derecha (se encienden con cada dato). */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="neo-raised grid size-10 place-items-center rounded-xl">
            <FiLayers aria-hidden="true" className="text-accent-cyan" />
          </span>
          <div>
            <h2 className="font-semibold">Antes de investigar</h2>
            <p className="text-xs text-slate-400">Completa estos tres datos básicos</p>
          </div>
        </div>
        {/* Las tres caras se encienden según "litFacets". */}
        <FacetTriadGlyph lit={litFacets} />
      </div>

      {/* La lista de los tres datos obligatorios. "aria-label" le da nombre a la lista para lectores de pantalla. */}
      <ul className="flex flex-col gap-2" aria-label="Datos básicos para continuar">
        {/* Recorremos los tres datos obligatorios (problema, solución, segmento). */}
        {REQUIRED_ATTRIBUTES.map((type) => {
          // "done" es true si el dato NO está en la lista de faltantes.
          const done = !structure.missing.includes(type);
          return (
            <li key={type} className="flex items-center gap-2.5 text-sm">
              {/* Palomita verde si está listo; círculo gris vacío si falta. */}
              {done ? (
                <FiCheckCircle aria-hidden="true" className="shrink-0 text-emerald-300" />
              ) : (
                <FiCircle aria-hidden="true" className="shrink-0 text-slate-500" />
              )}
              {/* El nombre del dato, en blanco si está listo y en gris si falta. */}
              <span className={done ? "text-slate-100" : "text-slate-400"}>{ATTRIBUTE_META[type].label}</span>
              {/* Solo para lectores de pantalla: dice si está confirmado o pendiente, porque el color no lo dice. */}
              <span className="sr-only">{done ? "(confirmado)" : "(pendiente)"}</span>
            </li>
          );
        })}
      </ul>

      {/* Si hay sugerencias de la IA sin revisar, avisamos. Esas no cuentan hasta que la persona las acepte o las borre. */}
      {structure.pending_suggestions > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-kind-hypothesis/10 p-3 text-sm text-kind-hypothesis">
            <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            Hay {structure.pending_suggestions} propuesta(s) automáticas por revisar. Confírmalas o elimínalas antes de continuar.
        </p>
      )}

      {/* La parte de acción depende de la etapa. Se revisan los casos en orden. */}
      {status === "structured" ? (
        // Caso 1: ya está lista para investigar. Mostramos el aviso verde y el botón de buscar.
        <>
          {/* "role=status" avisa a lectores de pantalla que este mensaje es informativo. */}
          <div role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
            <p className="flex items-center gap-2 font-medium">
              <FiCheckCircle aria-hidden="true" /> ¡Listo para buscar información!
            </p>
            <p className="mt-1 text-emerald-100/80">
              Revisaremos fuentes públicas. Si cambias la idea, podrás confirmar estos datos otra vez.
            </p>
          </div>
          {/* El botón de investigar. Al empezar, llevamos a la pestaña de investigación. */}
          <StartResearchButton
            projectId={project.id}
            label="Buscar información en internet"
            onStarted={() => navigate(`/proyectos/${project.id}/investigacion`)}
          />
        </>
      ) : !editable ? (
        // Caso 2: ya se investigó o analizó. No se confirma de nuevo; solo se puede ver la investigación.
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">
            Esta idea ya tiene una búsqueda. Si la editas, te pediremos confirmar estos datos otra vez; los resultados anteriores se conservan.
          </p>
          <LinkButton
            to={`/proyectos/${project.id}/investigacion`}
            variant="secondary"
            icon={<FiCompass aria-hidden="true" />}
          >
            Ver investigación
          </LinkButton>
        </div>
      ) : (
        // Caso 3: borrador. Aquí se confirma la estructura cuando esté completa.
        editable && (
          <>
            {/* El error de confirmar, si hubo alguno (salvo el de "estructura incompleta", explicado arriba). */}
            {confirmError && <Alert>{errorMessageFrom(confirmError)}</Alert>}
            {/* El botón se apaga hasta que la idea esté lista ("structure.ready"). Muestra carga mientras confirma. */}
            <Button
              onClick={() => confirmStructure.mutate()}
              disabled={!structure.ready}
              loading={confirmStructure.isPending}
              icon={<FiCheckCircle aria-hidden="true" />}
            >
              Guardar y continuar
            </Button>
            {/* Si todavía no está lista, explicamos qué falta. */}
            {!structure.ready && (
              <p className="text-xs text-slate-400">
                Completa Problema, Solución y Cliente. Confirma al menos una respuesta en cada apartado.
              </p>
            )}
          </>
        )
      )}

      {/* Una pequeña leyenda que explica los tres tipos de etiqueta de origen que puede ver la persona. */}
      <div className="border-t border-slate-400/15 pt-4">
        <p className="mb-2 text-xs font-medium text-slate-400">¿Quién añadió cada dato?</p>
        <div className="flex flex-wrap gap-2">
          {/* Dato escrito por la persona. */}
          <OriginBadge origin="user" confirmed />
          {/* Sugerencia de IA pendiente. */}
          <OriginBadge origin="ai" confirmed={false} />
          {/* Sugerencia de IA ya confirmada. */}
          <OriginBadge origin="ai" confirmed />
        </div>
      </div>
    </GlassPanel>
  );
}
