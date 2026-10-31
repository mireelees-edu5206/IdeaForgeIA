/**
 * ARCHIVO: findings/CompetitorsTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Otras opciones del mercado". Muestra los negocios o alternativas que resuelven un
 * problema parecido al de la idea, agrupados por tipo, con un mapa circular (la "constelación")
 * que los ubica según qué tan parecidos son y qué tan fuerte parecen.
 *
 * ¿Para qué sirve?
 * Ayuda a ver quién compite (o podría competir) con la idea. Aparecer aquí NO confirma que sean
 * competencia: el texto de la pantalla lo aclara y la persona debe revisar cada caso.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "competidores").
 *
 * Partes de la pantalla:
 * - Botón para mostrar u ocultar el mapa circular (CompetitorConstellation).
 * - Botón "Añadir opción" con su formulario (CompetitorForm).
 * - El buscador de zonas y lugares (GeoExplorer).
 * - Las opciones agrupadas por tipo (CompetitorCard).
 * - Un grupo extra "Otros nombres mencionados": empresas que aparecen en los resultados pero que
 *   todavía no se añadieron como opción (EntityRow).
 */

/* "useState" guarda si el formulario está abierto, si el mapa se ve, y qué opción está seleccionada en el mapa. */
import { useState } from "react";
/* Iconos: lista, cuadrícula, más, recargar y grupo de personas. */
import { FiGrid, FiList, FiPlus, FiRefreshCw, FiUsers } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CrucibleGlyph } from "../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
/* Une clases de estilo y convierte errores a texto. */
import { cn } from "../../lib/cn";
import { errorMessageFrom } from "../../lib/formErrors";
/* Mensaje de "todavía no hay nada". */
import { EmptyState } from "../projects/components/EmptyState";
/* El proyecto que entregó el detalle a esta pestaña. */
import { useProjectOutlet } from "../projects/outlet";
/* El buscador de zonas y lugares del mapa (carpeta de geografía). */
import { GeoExplorer } from "../geo/GeoExplorer";
/* Tarjeta de cada competidor y formulario para añadir uno. */
import { CompetitorCard } from "./components/CompetitorCard";
import { CompetitorForm } from "./components/CompetitorForm";
/* Textos de tipo, nombres de entidad y textos de riesgo. */
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, ENTITY_TYPE_LABELS, THREAT_META } from "./constants";
/* Consultas y acción de crear, desde la caché. */
import { useCompetitors, useCreateCompetitor, useEntities } from "./queries";
/* Tipos de competidor, entidad y nivel. */
import type { Competitor, CompetitorType, Entity, Level } from "./types";

/**
 * TYPE_OPTIONS: los cuatro tipos de competidor para el menú de cada nombre sin añadir.
 */
/** Catalogo TYPE_OPTIONS que define etiquetas o reglas de resultados. */
const TYPE_OPTIONS = COMPETITOR_TYPES.map((value) => ({ value, label: COMPETITOR_TYPE_META[value].label }));

/**
 * RING_RADIUS es el radio de cada anillo del mapa, en unidades del dibujo. El tipo más parecido
 * queda más cerca del centro (62) y el menos parecido, más lejos (152). Es como un tiro al blanco.
 */
/** Define RING_RADIUS para el bloque de resultados. */
const RING_RADIUS: Record<CompetitorType, number> = {
  direct: 62,
  indirect: 96,
  substitute: 126,
  alternative: 152,
};

/**
 * THREAT_SIZE es el tamaño del punto de cada competidor en el mapa: entre más riesgo, más grande.
 * Alto = 11, medio = 8.5, bajo = 6.5 y sin evaluar = 7.
 */
/** Define THREAT_SIZE para el bloque de resultados. */
const THREAT_SIZE: Record<Level, number> = {
  high: 11,
  medium: 8.5,
  low: 6.5,
  undetermined: 7,
};

/**
 * CompetitorConstellation dibuja el mapa circular con los competidores como puntos alrededor del
 * centro, y un panel con los datos del competidor seleccionado.
 *
 * Recibe: competitors (la lista de competidores del proyecto).
 *
 * Cómo se calcula la posición de cada punto:
 * 1. Se cuenta cuántos competidores hay en el mismo anillo (mismo tipo).
 * 2. Cada uno recibe un ángulo, repartido en círculo entre los de su anillo.
 * 3. Con el ángulo y el radio del anillo se calcula la posición (x, y) con seno y coseno.
 */
/** Componente CompetitorConstellation: renderiza la vista de resultados. */
function CompetitorConstellation({ competitors }: { competitors: Competitor[] }) {
  // "selectedId" guarda el competidor elegido en el mapa. Empieza con el primero de la lista.
  const [selectedId, setSelectedId] = useState<string | null>(competitors[0]?.id ?? null);
  // El competidor activo: el seleccionado, o el primero si el seleccionado ya no existe.
  const active = competitors.find((item) => item.id === selectedId) ?? competitors[0];

  // Calculamos la posición de cada punto del mapa.
  const nodes = competitors.map((competitor, index) => {
    // Todos los competidores del mismo tipo, para repartirlos en su anillo.
    const sameRing = competitors.filter((item) => item.competitor_type === competitor.competitor_type);
    // En qué lugar del anillo está este competidor.
    const posInRing = sameRing.findIndex((item) => item.id === competitor.id);
    // El ángulo: una vuelta completa (2π) repartida entre los del anillo. "- π/2" empieza arriba.
    // "index * 0.18" desfasa un poco cada punto para que no caigan todos alineados.
    const angle = (posInRing / Math.max(1, sameRing.length)) * Math.PI * 2 - Math.PI / 2 + index * 0.18;
    // El radio del anillo de este tipo.
    const radius = RING_RADIUS[competitor.competitor_type];
    return {
      competitor,
      // Posición horizontal: el centro (190) más el coseno del ángulo por el radio.
      x: 190 + Math.cos(angle) * radius,
      // Posición vertical: el centro (170) más el seno del ángulo por el radio.
      y: 170 + Math.sin(angle) * radius,
      // Tamaño del punto según el riesgo.
      r: THREAT_SIZE[competitor.threat_level],
    };
  });

  return (
    // Tarjeta con dos columnas en pantallas grandes: el mapa a la izquierda y el detalle a la derecha.
    <GlassPanel className="stage-3d grid gap-5 rounded-3xl p-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div className="neo-inset relative flex items-center justify-center overflow-hidden rounded-3xl p-3">
        {/* El dibujo. "aria-label" lo describe para lectores de pantalla. */}
        <svg viewBox="0 0 380 340" className="h-72 w-full max-w-md" aria-label="Mapa orbital de competidores">
          {/* Los cuatro anillos punteados, uno por tipo. */}
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
          {/* Cada competidor: su línea hacia el centro, su punto y su nombre. */}
          {nodes.map(({ competitor, x, y, r }) => {
            // ¿Es el seleccionado? Así se resalta (línea más gruesa, color cian, punto más grande).
            const isSelected = active?.id === competitor.id;
            return (
              <g
                key={competitor.id}
                // Al hacer clic en el punto, se selecciona ese competidor.
                onClick={() => setSelectedId(competitor.id)}
                className="cursor-pointer"
              >
                {/* La línea que une el centro con el punto. */}
                <line
                  x1="190"
                  y1="170"
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth={isSelected ? "1.6" : "0.8"}
                  className={isSelected ? "text-accent-cyan" : "text-slate-400/30"}
                />
                {/* El punto. Si está seleccionado, crece 3 unidades. Su color depende del riesgo: rosa (alto), ámbar (medio) o verde (bajo). */}
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
                {/* El nombre encima del punto, cortado a 18 letras para que no invada el mapa. */}
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
          {/* El centro del mapa: el punto de la propia idea. */}
          <circle cx="190" cy="170" r="14" className="fill-accent-cyan/25 stroke-accent-cyan" strokeWidth="1.6" />
        </svg>
      </div>

      {/* El detalle del competidor seleccionado: su tipo, riesgo, nombre, una pista y su análisis. */}
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
          {/* El análisis del competidor, si existe. */}
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

/**
 * EntityRow dibuja una fila de la lista "Otros nombres mencionados": un nombre que aparece en los
 * resultados pero que todavía no es opción. Permite elegir su tipo y añadirlo con un clic.
 *
 * Recibe:
 * - projectId: el proyecto.
 * - entity: el nombre (empresa o producto) con cuántos resultados lo mencionan.
 */
/** Componente EntityRow: renderiza la vista de resultados. */
function EntityRow({ projectId, entity }: { projectId: string; entity: Entity }) {
  // La acción de añadir este nombre como competidor.
  const create = useCreateCompetitor(projectId);
  // El tipo que se le dará al añadirlo. Empieza en "muy parecida".
  const [type, setType] = useState<CompetitorType>("direct");
  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-slate-100">{entity.name}</p>
        <p className="text-xs text-slate-400">
          {ENTITY_TYPE_LABELS[entity.entity_type]} · aparece en {entity.finding_count}{" "}
          {entity.finding_count === 1 ? "resultado" : "resultados"}
        </p>
        {/* Si falló añadirlo, el motivo aparece aquí. */}
        {create.isError && (
          <div className="mt-2">
            <Alert>{errorMessageFrom(create.error)}</Alert>
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        {/* El menú de tipo. Su etiqueta está oculta visualmente ("hideLabel"), pero la leen los lectores de pantalla. */}
        <Select label={`Qué tan parecida es la opción ${entity.name}`} hideLabel value={type} options={TYPE_OPTIONS} onChange={setType} />
        {/* Al pulsar, crea el competidor vinculado a esta entidad. */}
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

/**
 * CompetitorsTab dibuja la pestaña completa, con sus casos de carga, error, vacío y contenido.
 */
/** Expone la funcion competitors tab para el flujo de findings. */
export function CompetitorsTab() {
  // El proyecto que entregó el detalle.
  const { project } = useProjectOutlet();
  // Los competidores y los nombres del proyecto, desde la caché.
  const competitors = useCompetitors(project.id);
  const entities = useEntities(project.id);
  // "creating": si el formulario de añadir está abierto. "showConstellation": si el mapa circular se ve.
  const [creating, setCreating] = useState(false);
  const [showConstellation, setShowConstellation] = useState(true);

  // Caso 1: cargando los competidores. Mostramos la ruedita.
  /** Rama condicional: competitors.isPending. */
  if (competitors.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando opciones…
      </div>
    );
  }
  // Caso 2: hubo error. Mostramos el motivo con un botón para reintentar.
  /** Rama condicional: competitors.isError. */
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

  // Los nombres que todavía NO son competidores. "=== null" significa que no se han convertido en opción.
  // "?? []" usa lista vacía si los nombres todavía no cargaron.
  const others = entities.data?.filter((entity) => entity.competitor_id === null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* La cabecera: título, explicación, botón de mostrar u ocultar el mapa y botón de añadir. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Otras opciones del mercado</h2>
          <p className="text-sm text-slate-400">
            Negocios o alternativas que resuelven un problema parecido. Aparecer aquí no confirma que sean competencia: revisa cada caso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* El botón del mapa solo aparece si hay competidores que dibujar. Cambia su texto e icono según el estado. */}
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
          {/* El botón de añadir: oculto mientras el formulario está abierto. */}
          {!creating && (
            <Button icon={<FiPlus aria-hidden="true" />} onClick={() => setCreating(true)}>
              Añadir opción
            </Button>
          )}
        </div>
      </div>

      {/* El formulario de añadir, dentro de una tarjeta. Al terminar, se cierra. */}
      {creating && (
        <GlassPanel className="p-5">
          <h3 className="mb-4 font-semibold">Añade una opción que conozcas</h3>
          <CompetitorForm projectId={project.id} onDone={() => setCreating(false)} />
        </GlassPanel>
      )}

      {/* El buscador de zonas y lugares del mapa (carpeta de geografía). */}
      <GeoExplorer />

      {/* Si no hay competidores, un mensaje de orientación. Si los hay, el mapa (si está visible) y los grupos. */}
      {competitors.data.length === 0 ? (
        <EmptyState
          icon={FiUsers}
          title="Aún no hay opciones registradas"
          description="Puedes buscarlas en el mapa o añadir negocios y alternativas que ya conozcas."
        />
      ) : (
        <>
          {showConstellation && <CompetitorConstellation competitors={competitors.data} />}
          {/* Un grupo por tipo de competidor, en el orden de COMPETITOR_TYPES. */}
          {COMPETITOR_TYPES.map((type) => {
            // Los competidores de este tipo.
            const group = competitors.data.filter((c) => c.competitor_type === type);
            // Si el grupo está vacío, no dibujamos su sección.
            /** Rama condicional: group.length === 0. */
            if (group.length === 0) return null;
            // El nombre de grupo y su explicación, tomados de COMPETITOR_TYPE_META.
            const { plural, description } = COMPETITOR_TYPE_META[type];
            return (
              <section key={type} aria-labelledby={`grupo-${type}`} className="flex flex-col gap-3">
                <div>
                  <h3 id={`grupo-${type}`} className="font-semibold">
                    {plural} <span className="text-sm font-normal text-slate-400">({group.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">{description}</p>
                </div>
                {/* Las tarjetas del grupo, en dos columnas en pantallas grandes. */}
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

      {/* Los nombres mencionados en los resultados que todavía no son opciones. Solo si hay alguno. */}
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
