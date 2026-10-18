import { FiCheckCircle, FiCpu, FiUser, FiXCircle } from "react-icons/fi";

import { Badge } from "../../../components/ui/Badge";
import type { Origin } from "../../projects/types";
import { CONFIDENCE_META, STANCE_META, THREAT_META } from "../constants";
import type { EvidenceStance, Level, ReviewStatus } from "../types";

export function ConfidenceBadge({ level }: { level: Level }) {
  const { label, className } = CONFIDENCE_META[level];
  return <Badge className={className}>{label}</Badge>;
}

export function ThreatBadge({ level }: { level: Level }) {
  const { label, className } = THREAT_META[level];
  return <Badge className={className}>{label}</Badge>;
}

export function StanceBadge({ stance }: { stance: EvidenceStance }) {
  const { label, className } = STANCE_META[stance];
  return <Badge className={className}>{label}</Badge>;
}

/** Procedencia y revisión: propuesta de la IA (pendiente/aceptada/rechazada) o dato del usuario. */
export function ProvenanceBadge({ origin, review }: { origin: Origin; review: ReviewStatus }) {
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
