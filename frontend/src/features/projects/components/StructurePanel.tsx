import { FiAlertCircle, FiCheckCircle, FiCircle, FiCompass, FiLayers } from "react-icons/fi";
import { useNavigate } from "react-router";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { FacetTriadGlyph } from "../../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { LinkButton } from "../../../components/ui/LinkButton";
import { ApiError } from "../../../lib/apiClient";
import { errorMessageFrom } from "../../../lib/formErrors";
import { StartResearchButton } from "../../research/components/StartResearchButton";
import { ATTRIBUTE_META, REQUIRED_ATTRIBUTES } from "../constants";
import { useConfirmStructure } from "../queries";
import type { ProjectDetail } from "../types";
import { OriginBadge } from "./badges";

export function StructurePanel({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const confirmStructure = useConfirmStructure(project.id);
  const { structure, status } = project;
  const editable = status === "draft" || status === "structured";
  const confirmError =
    confirmStructure.error instanceof ApiError && confirmStructure.error.code === "structure_incomplete"
      ? null
      : confirmStructure.error;

  const litFacets = REQUIRED_ATTRIBUTES.length - structure.missing.length;

  return (
    <GlassPanel className="stage-3d flex flex-col gap-5 rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="neo-raised grid size-10 place-items-center rounded-xl">
            <FiLayers aria-hidden="true" className="text-accent-cyan" />
          </span>
          <div>
            <h2 className="font-semibold">Estructura de la idea</h2>
            <p className="text-xs text-slate-400">Mínimo necesario para investigar</p>
          </div>
        </div>
        <FacetTriadGlyph lit={litFacets} />
      </div>

      <ul className="flex flex-col gap-2" aria-label="Atributos obligatorios">
        {REQUIRED_ATTRIBUTES.map((type) => {
          const done = !structure.missing.includes(type);
          return (
            <li key={type} className="flex items-center gap-2.5 text-sm">
              {done ? (
                <FiCheckCircle aria-hidden="true" className="shrink-0 text-emerald-300" />
              ) : (
                <FiCircle aria-hidden="true" className="shrink-0 text-slate-500" />
              )}
              <span className={done ? "text-slate-100" : "text-slate-400"}>{ATTRIBUTE_META[type].label}</span>
              <span className="sr-only">{done ? "(confirmado)" : "(pendiente)"}</span>
            </li>
          );
        })}
      </ul>

      {structure.pending_suggestions > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-kind-hypothesis/10 p-3 text-sm text-kind-hypothesis">
          <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          Tienes {structure.pending_suggestions} sugerencia(s) de IA sin revisar. Confírmalas o elimínalas.
        </p>
      )}

      {status === "structured" ? (
        <>
          <div role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
            <p className="flex items-center gap-2 font-medium">
              <FiCheckCircle aria-hidden="true" /> Estructura confirmada
            </p>
            <p className="mt-1 text-emerald-100/80">
              Siguiente paso: investigar la idea. Si cambias la idea o sus atributos, el proyecto volverá a Borrador.
            </p>
          </div>
          <StartResearchButton
            projectId={project.id}
            onStarted={() => navigate(`/proyectos/${project.id}/investigacion`)}
          />
        </>
      ) : !editable ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">
            Esta idea ya se investigó. Si la modificas, el proyecto volverá a Borrador y tendrás que confirmar la
            estructura de nuevo; las investigaciones anteriores se conservan.
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
        editable && (
          <>
            {confirmError && <Alert>{errorMessageFrom(confirmError)}</Alert>}
            <Button
              onClick={() => confirmStructure.mutate()}
              disabled={!structure.ready}
              loading={confirmStructure.isPending}
              icon={<FiCheckCircle aria-hidden="true" />}
            >
              Confirmar estructura
            </Button>
            {!structure.ready && (
              <p className="text-xs text-slate-400">
                Confirma al menos un valor de cada atributo obligatorio para continuar.
              </p>
            )}
          </>
        )
      )}

      <div className="border-t border-slate-400/15 pt-4">
        <p className="mb-2 text-xs font-medium text-slate-400">Cómo leer las etiquetas</p>
        <div className="flex flex-wrap gap-2">
          <OriginBadge origin="user" confirmed />
          <OriginBadge origin="ai" confirmed={false} />
          <OriginBadge origin="ai" confirmed />
        </div>
      </div>
    </GlassPanel>
  );
}
