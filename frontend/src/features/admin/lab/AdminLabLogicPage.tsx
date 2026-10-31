/**
 * ARCHIVO: admin/lab/AdminLabLogicPage.tsx
 *
 * ¿Qué es?
 * Es la página "Proposiciones y tablas de verdad". Muestra las reglas lógicas que el sistema ya aplica
 * (por ejemplo, cuándo una idea está lista) como tablas de verdad, y el marco PEAS del agente.
 *
 * ¿Para qué sirve?
 * Explica, con tablas, las reglas exactas que usa IdeaForge. No agrega criterios nuevos ni depende
 * del proyecto elegido: los datos son fijos y vienen del servidor.
 *
 * ¿Quién la usa?
 * Se abre desde el laboratorio (ruta "admin/laboratorio/proposiciones"), solo para administradores.
 *
 * Qué ve la persona:
 * - Un encabezado con un botón para volver al laboratorio.
 * - Una tarjeta por regla. La primera viene abierta; las demás se abren al tocarlas.
 * - Dentro de cada regla: la fórmula, la tabla de verdad (V = verdadero, F = falso), el significado
 *   de cada proposición y la nota de cómo la aplica IdeaForge.
 * - Al final, las cuatro partes PEAS del agente.
 */

/* Iconos: flecha hacia atrás y libro. */
import { FiArrowLeft, FiBookOpen } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { LinkButton } from "../../../components/ui/LinkButton";
import { Spinner } from "../../../components/ui/Spinner";
/* Convierte errores a texto y pone el título de la pestaña del navegador. */
import { errorMessageFrom } from "../../../lib/formErrors";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
/* Cabecera de página compartida (de la carpeta de proyectos). */
import { PageHeader } from "../../projects/components/PageHeader";
/* La consulta de las reglas y el tipo de cada regla. */
import { useAdminLabPropositions } from "../queries";
import type { PropositionRuleTable } from "../types";

/**
 * RuleCard dibuja una regla como un desplegable (details/summary) con su tabla de verdad.
 *
 * Recibe:
 * - rule: la regla completa (fórmula, filas, proposiciones y nota).
 * - expanded: si arranca abierta (true) o cerrada (false).
 *
 * Detalle de la tabla: cada fila es una combinación de valores posibles de las proposiciones.
 * La última columna es el resultado. Las filas que dan resultado verdadero se pintan en verde.
 */
/** Componente RuleCard: renderiza la vista de administracion. */
function RuleCard({ rule, expanded }: { rule: PropositionRuleTable; expanded: boolean }) {
  return (
    // "details" es un bloque que se abre y se cierra. "open" decide si arranca abierto.
    <details open={expanded} className="surface-panel rounded-2xl p-5 sm:p-6">
      {/* El título visible del desplegable: nombre, explicación y el número de combinaciones. */}
      <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block font-display text-lg font-bold text-slate-100">{rule.title}</span>
          <span className="mt-1 block max-w-3xl text-sm text-slate-400">{rule.description}</span>
        </span>
        <span className="flex items-center gap-2">
          <Badge>{rule.rows.length} combinaciones</Badge>
          <span className="text-xs text-accent-cyan">Abrir / cerrar tabla</span>
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        {/* La fórmula escrita con símbolos. "V = verdadero · F = falso" explica las letras de la tabla. */}
        <div className="neo-inset rounded-xl p-3">
          <p className="text-[10px] font-semibold tracking-wider text-accent-cyan uppercase">
            Proposición lógica
          </p>
          <code className="mt-1 block break-words text-sm text-slate-100">{rule.formula}</code>
          <p className="mt-2 text-[10px] text-slate-500">V = verdadero · F = falso</p>
        </div>

        {/* La tabla de verdad. El "caption" con sr-only lo lee un lector de pantalla pero no se ve. */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Tabla de verdad: {rule.title}</caption>
            <thead className="border-b border-slate-400/20 text-slate-400">
              <tr>
                {/* Un encabezado por cada proposición de entrada. "title" muestra su significado al pasar el mouse. */}
                {rule.inputs.map((input) => (
                  <th key={input.symbol} className="min-w-16 p-2" title={input.meaning}>
                    {input.symbol}
                  </th>
                ))}
                {/* El encabezado del resultado, resaltado en cian. */}
                <th className="min-w-20 p-2 font-bold text-accent-cyan" title={rule.output.meaning}>
                  {rule.output.symbol}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400/10">
              {rule.rows.map((row, index) => (
                <tr
                  key={index}
                  // Si el resultado es verdadero, la fila va en verde; si no, en gris claro.
                  className={row.result ? "bg-emerald-500/10 text-emerald-200" : "text-slate-300"}
                >
                  {/* Una celda por proposición: "V" si su valor es verdadero, "F" si no. */}
                  {rule.inputs.map((input) => (
                    <td key={input.symbol} className="p-2">
                      {row.values[input.symbol] ? "V" : "F"}
                    </td>
                  ))}
                  {/* La celda del resultado, en negrita. */}
                  <td className="p-2 font-bold">{row.result ? "V" : "F"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dos cuadros lado a lado en pantallas grandes: el significado de cada proposición y la nota de la regla. */}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="neo-inset rounded-xl p-3">
            <h3 className="text-xs font-semibold text-slate-200">Significado de las proposiciones</h3>
            <dl className="mt-2 flex flex-col gap-2">
              {rule.inputs.map((input) => (
                <div key={input.symbol} className="text-xs">
                  <dt className="inline font-semibold text-accent-cyan">{input.symbol} · {input.name}: </dt>
                  <dd className="inline text-slate-400">{input.meaning}</dd>
                </div>
              ))}
              {/* El significado de la salida, en violeta para distinguirlo de las entradas. */}
              <div className="text-xs">
                <dt className="inline font-semibold text-accent-violet">
                  {rule.output.symbol} · {rule.output.name}:{" "}
                </dt>
                <dd className="inline text-slate-400">{rule.output.meaning}</dd>
              </div>
            </dl>
          </div>
          <div className="neo-inset rounded-xl p-3">
            <h3 className="text-xs font-semibold text-slate-200">Regla real de IdeaForge</h3>
            <p className="mt-2 text-xs text-slate-400">{rule.note}</p>
            {/* De qué parte del código sale la regla (por ejemplo, el nombre de un archivo). */}
            <p className="mt-3 break-all font-mono text-[10px] text-slate-500">{rule.source}</p>
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * AdminLabLogicPage dibuja la página completa. Pide las reglas al servidor y muestra:
 * cargando (ruedita), error (aviso) o el contenido (reglas y PEAS).
 */
/** Expone la funcion admin lab logic page para el flujo de admin. */
export function AdminLabLogicPage() {
  // Cambia el título de la pestaña del navegador mientras esta página está abierta.
  useDocumentTitle("Proposiciones y tablas de verdad · IdeaForge AI");
  // Pide las reglas y el PEAS al servidor.
  const query = useAdminLabPropositions();

  return (
    <div className="flex flex-col gap-6">
      {/* La cabecera: título, explicación y el botón para volver al laboratorio. */}
      <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
        <PageHeader
          eyebrow="Reglas generales de IdeaForge AI"
          title="Proposiciones y tablas de verdad"
          description="Estas tablas expresan reglas que ya aplica el sistema en proyectos, investigación, análisis, evidencia y reportes. No dependen del proyecto seleccionado ni agregan criterios nuevos."
          actions={
            <>
              <LinkButton
                to="/admin/laboratorio"
                variant="secondary"
                size="sm"
                icon={<FiArrowLeft aria-hidden="true" />}
              >
                Laboratorio de algoritmos
              </LinkButton>
              <Badge>
                <FiBookOpen aria-hidden="true" /> Lógica del sistema
              </Badge>
            </>
          }
        />
      </GlassPanel>

      {/* Cargando, error o contenido. */}
      {query.isPending ? (
        <div role="status" className="flex justify-center py-10">
          <Spinner className="size-6 text-accent-cyan" />
        </div>
      ) : query.isError ? (
        <Alert>{errorMessageFrom(query.error)}</Alert>
      ) : (
        <>
          {/* Una tarjeta por regla. Solo la primera (índice 0) arranca abierta. */}
          <section aria-label="Reglas lógicas implementadas" className="flex flex-col gap-4">
            {query.data.rules.map((rule, index) => (
              <RuleCard key={rule.id} rule={rule} expanded={index === 0} />
            ))}
          </section>

          {/* El marco PEAS: cuatro tarjetas en fila en pantallas muy grandes. */}
          <GlassPanel className="rounded-3xl p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">PEAS del agente IdeaForge AI</h2>
            <p className="mt-1 text-sm text-slate-400">
              Descripción general del agente: desempeño, entorno, acciones y entradas que usa.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {query.data.peas.map((item) => (
                <article key={item.symbol} className="neo-inset rounded-xl p-3 text-xs">
                  <h3 className="font-semibold text-accent-cyan">
                    {item.symbol} · {item.name}
                  </h3>
                  <p className="mt-1 text-slate-400">{item.description}</p>
                </article>
              ))}
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
}
