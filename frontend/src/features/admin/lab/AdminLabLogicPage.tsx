import { FiArrowLeft, FiBookOpen } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { LinkButton } from "../../../components/ui/LinkButton";
import { Spinner } from "../../../components/ui/Spinner";
import { errorMessageFrom } from "../../../lib/formErrors";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { PageHeader } from "../../projects/components/PageHeader";
import { useAdminLabPropositions } from "../queries";
import type { PropositionRuleTable } from "../types";

function RuleCard({ rule, expanded }: { rule: PropositionRuleTable; expanded: boolean }) {
  return (
    <details open={expanded} className="surface-panel rounded-2xl p-5 sm:p-6">
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
        <div className="neo-inset rounded-xl p-3">
          <p className="text-[10px] font-semibold tracking-wider text-accent-cyan uppercase">
            Proposición lógica
          </p>
          <code className="mt-1 block break-words text-sm text-slate-100">{rule.formula}</code>
          <p className="mt-2 text-[10px] text-slate-500">V = verdadero · F = falso</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Tabla de verdad: {rule.title}</caption>
            <thead className="border-b border-slate-400/20 text-slate-400">
              <tr>
                {rule.inputs.map((input) => (
                  <th key={input.symbol} className="min-w-16 p-2" title={input.meaning}>
                    {input.symbol}
                  </th>
                ))}
                <th className="min-w-20 p-2 font-bold text-accent-cyan" title={rule.output.meaning}>
                  {rule.output.symbol}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400/10">
              {rule.rows.map((row, index) => (
                <tr
                  key={index}
                  className={row.result ? "bg-emerald-500/10 text-emerald-200" : "text-slate-300"}
                >
                  {rule.inputs.map((input) => (
                    <td key={input.symbol} className="p-2">
                      {row.values[input.symbol] ? "V" : "F"}
                    </td>
                  ))}
                  <td className="p-2 font-bold">{row.result ? "V" : "F"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
            <p className="mt-3 break-all font-mono text-[10px] text-slate-500">{rule.source}</p>
          </div>
        </div>
      </div>
    </details>
  );
}

export function AdminLabLogicPage() {
  useDocumentTitle("Proposiciones y tablas de verdad · IdeaForge AI");
  const query = useAdminLabPropositions();

  return (
    <div className="flex flex-col gap-6">
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
                Laboratorio aplicado
              </LinkButton>
              <Badge>
                <FiBookOpen aria-hidden="true" /> Lógica del sistema
              </Badge>
            </>
          }
        />
      </GlassPanel>

      {query.isPending ? (
        <div role="status" className="flex justify-center py-10">
          <Spinner className="size-6 text-accent-cyan" />
        </div>
      ) : query.isError ? (
        <Alert>{errorMessageFrom(query.error)}</Alert>
      ) : (
        <>
          <section aria-label="Reglas lógicas implementadas" className="flex flex-col gap-4">
            {query.data.rules.map((rule, index) => (
              <RuleCard key={rule.id} rule={rule} expanded={index === 0} />
            ))}
          </section>

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
