/**
 * ARCHIVO: findings/components/badges.tsx
 *
 * ¿Qué es?
 * Son los "stickers" de los resultados: el nivel de confianza, el nivel de riesgo, si la evidencia
 * respalda o contradice, y de quién es un resultado (de la IA o de la persona) con su revisión.
 *
 * ¿Para qué sirve?
 * Para que la persona distinga de un vistazo lo que es suyo de lo que propuso la IA, y lo que ya
 * aceptó de lo que todavía no revisó. Una propuesta de IA no se trata como un hecho hasta aceptarla.
 *
 * ¿Quién lo usa?
 * FindingCard.tsx, CompetitorCard.tsx, FindingsTab.tsx y las demás tarjetas de resultados.
 */

/* Iconos: palomita (aceptado), chip (IA), persona (usuario) y X (rechazado). */
import { FiCheckCircle, FiCpu, FiUser, FiXCircle } from "react-icons/fi";

/* La etiqueta base de la app. */
import { Badge } from "../../../components/ui/Badge";
/* Tipo de origen (IA o usuario), de la carpeta de proyectos. */
import type { Origin } from "../../projects/types";
/* Textos y colores de cada nivel, riesgo y postura. */
import { CONFIDENCE_META, STANCE_META, THREAT_META } from "../constants";
/* Tipos de nivel, postura y revisión. */
import type { EvidenceStance, Level, ReviewStatus } from "../types";

/**
 * ConfidenceBadge muestra qué tan confiable parece un resultado (alta, media, baja o indeterminada).
 * Recibe: level (el nivel).
 */
/** Expone la funcion confidence badge para el flujo de findings. */
export function ConfidenceBadge({ level }: { level: Level }) {
  // Sacamos el texto y el color del nivel de confianza.
  const { label, className } = CONFIDENCE_META[level];
  return <Badge className={className}>{label}</Badge>;
}

/**
 * ThreatBadge muestra el nivel de riesgo de un competidor (alto, medio, bajo o sin evaluar).
 * Recibe: level (el nivel de riesgo).
 */
/** Expone la funcion threat badge para el flujo de findings. */
export function ThreatBadge({ level }: { level: Level }) {
  // Sacamos el texto y el color del riesgo.
  const { label, className } = THREAT_META[level];
  return <Badge className={className}>{label}</Badge>;
}

/**
 * StanceBadge muestra si una evidencia respalda, contradice o solo da contexto.
 * Recibe: stance (la postura).
 */
/** Expone la funcion stance badge para el flujo de findings. */
export function StanceBadge({ stance }: { stance: EvidenceStance }) {
  // Sacamos el texto y el color de la postura.
  const { label, className } = STANCE_META[stance];
  return <Badge className={className}>{label}</Badge>;
}

/**
 * ProvenanceBadge dice de quién es un resultado y si ya se revisó. Tiene cuatro casos:
 * 1. La persona lo escribió ("user"): "Aportado por el usuario", en azul de datos.
 * 2. La IA lo propuso y todavía no se revisa ("proposed"): etiqueta punteada color ámbar, "sin revisar".
 * 3. La IA lo propuso y la persona lo aceptó ("accepted"): azul, con palomita.
 * 4. La IA lo propuso y la persona lo rechazó: rosa, con X.
 *
 * Recibe:
 * - origin: "user" o "ai".
 * - review: el estado de revisión (solo importa cuando el origen es la IA).
 */
/** Procedencia y revisión: propuesta de la IA (pendiente/aceptada/rechazada) o dato del usuario. */
export function ProvenanceBadge({ origin, review }: { origin: Origin; review: ReviewStatus }) {
  // Caso 1: lo escribió la persona. No hay revisión que mostrar.
  /** Rama condicional: origin === "user". */
  if (origin === "user") {
    return (
      <Badge
        className="bg-kind-data/10 text-kind-data ring-kind-data/30"
        icon={<FiUser aria-hidden="true" className="size-3.5" />}
      >
        Aportado por el usuario
      </Badge>
    );
  }
  // Caso 2: propuesta de la IA pendiente de revisar. Estilo punteado para que se vea provisional.
  /** Rama condicional: review === "proposed". */
  if (review === "proposed") {
    return (
      <Badge
        className="border border-dashed border-kind-hypothesis/60 bg-kind-hypothesis/10 text-kind-hypothesis ring-0"
        icon={<FiCpu aria-hidden="true" className="size-3.5" />}
      >
        Propuesto por la IA · sin revisar
      </Badge>
    );
  }
  // Casos 3 y 4: la IA lo propuso y la persona ya decidió. "accepted" es true solo en el caso 3.
  const accepted = review === "accepted";
  return (
    <Badge
      className={
        accepted
          ? "bg-kind-analysis/10 text-kind-analysis ring-kind-analysis/30"
          : "bg-rose-400/10 text-rose-200 ring-rose-300/30"
      }
      icon={
        accepted ? (
          <FiCheckCircle aria-hidden="true" className="size-3.5" />
        ) : (
          <FiXCircle aria-hidden="true" className="size-3.5" />
        )
      }
    >
      {accepted ? "Propuesto por la IA · aceptado" : "Propuesto por la IA · rechazado"}
    </Badge>
  );
}
