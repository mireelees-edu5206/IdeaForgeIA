import { useState } from "react";
import { FiGrid, FiList, FiPlus, FiRefreshCw, FiUsers } from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CrucibleGlyph } from "../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { cn } from "../../lib/cn";
import { errorMessageFrom } from "../../lib/formErrors";
import { EmptyState } from "../projects/components/EmptyState";
import { useProjectOutlet } from "../projects/outlet";
import { GeoExplorer } from "../geo/GeoExplorer";
import { CompetitorCard } from "./components/CompetitorCard";
import { CompetitorForm } from "./components/CompetitorForm";
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, ENTITY_TYPE_LABELS, THREAT_META } from "./constants";
import { useCompetitors, useCreateCompetitor, useEntities } from "./queries";
import type { Competitor, CompetitorType, Entity, Level } from "./types";

const TYPE_OPTIONS = COMPETITOR_TYPES.map((value) => ({ value, label: COMPETITOR_TYPE_META[value].label }));

const RING_RADIUS: Record<CompetitorType, number> = {
  direct: 62,
  indirect: 96,
  substitute: 126,
  alternative: 152,
};

const THREAT_SIZE: Record<Level, number> = {
  high: 11,
  medium: 8.5,
  low: 6.5,
  undetermined: 7,
};

function CompetitorConstellation({ competitors }: { competitors: Competitor[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(competitors[0]?.id ?? null);
  const active = competitors.find((item) => item.id === selectedId) ?? competitors[0];

  const nodes = competitors.map((competitor, index) => {
    const sameRing = competitors.filter((item) => item.competitor_type === competitor.competitor_type);
    const posInRing = sameRing.findIndex((item) => item.id === competitor.id);
    const angle = (posInRing / Math.max(1, sameRing.length)) * Math.PI * 2 - Math.PI / 2 + index * 0.18;
    const radius = RING_RADIUS[competitor.competitor_type];
    return {
      competitor,
      x: 190 + Math.cos(angle) * radius,
      y: 170 + Math.sin(angle) * radius,
      r: THREAT_SIZE[competitor.threat_level],
    };
  });

  return (
    <GlassPanel className="stage-3d grid gap-5 rounded-3xl p-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div className="neo-inset relative flex items-center justify-center overflow-hidden rounded-3xl p-3">
        <svg viewBox="0 0 380 340" className="h-72 w-full max-w-md" aria-label="Mapa orbital de competidores">
          {COMPETITOR_TYPES.map((type) => (
            <circle
              key={type}
              cx="190"
              cy="170"
              r={RING_RADIUS[type]}
              fill="none"
              stroke="currentColor"
              strokeDasharray="3 4"
              className="text-slate-400/35"
            />
          ))}
          {nodes.map(({ competitor, x, y, r }) => {
            const isSelected = active?.id === competitor.id;
            return (
              <g
                key={competitor.id}
                onClick={() => setSelectedId(competitor.id)}
                className="cursor-pointer"
              >
                <line
                  x1="190"
                  y1="170"
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth={isSelected ? "1.6" : "0.8"}
                  className={isSelected ? "text-accent-cyan" : "text-slate-400/30"}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? r + 3 : r}
                  className={cn(
                    "transition-all",
                    competitor.threat_level === "high"
                      ? "fill-rose-300"
                      : competitor.threat_level === "medium"
                        ? "fill-amber-200"
                        : "fill-emerald-300",
                  )}
                />
                <text
                  x={x}
                  y={y - r - 6}
                  textAnchor="middle"
                  className="fill-current text-[10px] font-semibold text-slate-200"
                >
                  {competitor.entity.name.slice(0, 18)}
                </text>
              </g>
            );
          })}
          <circle cx="190" cy="170" r="14" className="fill-accent-cyan/25 stroke-accent-cyan" strokeWidth="1.6" />
        </svg>
      </div>

      {active && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-accent-cyan">
            <CrucibleGlyph className="size-4" />
            <span className="font-mono-tech font-semibold uppercase">
              {COMPETITOR_TYPE_META[active.competitor_type].plural} · {THREAT_META[active.threat_level].label}
            </span>
          </div>
          <h3 className="font-display text-xl font-bold">{active.entity.name}</h3>
          <p className="text-xs text-slate-400">
            Haz clic en cualquier nodo orbital para inspeccionar su distancia competitiva y amenaza.
          </p>
          {active.rationale && (
            <p className="neo-inset rounded-2xl p-3.5 text-sm leading-relaxed text-slate-200">
              {active.rationale}
            </p>
          )}
        </div>
      )}
    </GlassPanel>
  );
}

function EntityRow({ projectId, entity }: { projectId: string; entity: Entity }) {
  const create = useCreateCompetitor(projectId);
  const [type, setType] = useState<CompetitorType>("direct");
  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-slate-100">{entity.name}</p>
        <p className="text-xs text-slate-400">
          {ENTITY_TYPE_LABELS[entity.entity_type]} · aparece en {entity.finding_count}{" "}
          {entity.finding_count === 1 ? "resultado" : "resultados"}
        </p>
        {create.isError && (
          <div className="mt-2">
            <Alert>{errorMessageFrom(create.error)}</Alert>
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <Select label={`Qué tan parecida es la opción ${entity.name}`} hideLabel value={type} options={TYPE_OPTIONS} onChange={setType} />
        <Button
          size="sm"
          variant="secondary"
          loading={create.isPending}
          onClick={() => create.mutate({ entity_id: entity.id, competitor_type: type })}
        >
          Añadir como opción
        </Button>
      </div>
    </li>
  );
}

export function CompetitorsTab() {
  const { project } = useProjectOutlet();
  const competitors = useCompetitors(project.id);
  const entities = useEntities(project.id);
  const [creating, setCreating] = useState(false);
  const [showConstellation, setShowConstellation] = useState(true);

  if (competitors.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando opciones…
      </div>
    );
  }
  if (competitors.isError) {
    return (
      <GlassPanel className="flex flex-col items-start gap-4 p-6">
        <Alert>{errorMessageFrom(competitors.error)}</Alert>
        <Button variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={() => competitors.refetch()}>
          Reintentar
        </Button>
      </GlassPanel>
    );
  }

  const others = entities.data?.filter((entity) => entity.competitor_id === null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Otras opciones del mercado</h2>
          <p className="text-sm text-slate-400">
            Negocios o alternativas que resuelven un problema parecido. Aparecer aquí no confirma que sean competencia: revisa cada caso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {competitors.data.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={showConstellation ? <FiList aria-hidden="true" /> : <FiGrid aria-hidden="true" />}
              onClick={() => setShowConstellation((current) => !current)}
            >
              {showConstellation ? "Ocultar mapa de opciones" : "Ver mapa de opciones"}
            </Button>
          )}
          {!creating && (
            <Button icon={<FiPlus aria-hidden="true" />} onClick={() => setCreating(true)}>
              Añadir opción
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <GlassPanel className="p-5">
          <h3 className="mb-4 font-semibold">Añade una opción que conozcas</h3>
          <CompetitorForm projectId={project.id} onDone={() => setCreating(false)} />
        </GlassPanel>
      )}

      <GeoExplorer />

      {competitors.data.length === 0 ? (
        <EmptyState
          icon={FiUsers}
          title="Aún no hay opciones registradas"
          description="Puedes buscarlas en el mapa o añadir negocios y alternativas que ya conozcas."
        />
      ) : (
        <>
          {showConstellation && <CompetitorConstellation competitors={competitors.data} />}
          {COMPETITOR_TYPES.map((type) => {
            const group = competitors.data.filter((c) => c.competitor_type === type);
            if (group.length === 0) return null;
            const { plural, description } = COMPETITOR_TYPE_META[type];
            return (
              <section key={type} aria-labelledby={`grupo-${type}`} className="flex flex-col gap-3">
                <div>
                  <h3 id={`grupo-${type}`} className="font-semibold">
                    {plural} <span className="text-sm font-normal text-slate-400">({group.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">{description}</p>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {group.map((competitor) => (
                    <CompetitorCard key={competitor.id} projectId={project.id} competitor={competitor} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      {others.length > 0 && (
        <section aria-labelledby="otras-entidades" className="flex flex-col gap-3">
          <div>
            <h3 id="otras-entidades" className="font-semibold">
              Otros nombres mencionados
            </h3>
            <p className="text-xs text-slate-400">Aparecen en los resultados, pero todavía no se han añadido como opciones.</p>
          </div>
          <GlassPanel className="p-2">
            <ul className="divide-y divide-slate-400/15">
              {others.map((entity) => (
                <EntityRow key={entity.id} projectId={project.id} entity={entity} />
              ))}
            </ul>
          </GlassPanel>
        </section>
      )}
    </div>
  );
}
