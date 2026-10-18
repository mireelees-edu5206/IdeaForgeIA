import { FiCpu, FiUser } from "react-icons/fi";

import { Badge } from "../../../components/ui/Badge";
import { STATUS_META } from "../constants";
import type { Origin, ProjectStatus } from "../types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className, icon: Icon } = STATUS_META[status];
  return (
    <Badge className={className} icon={<Icon aria-hidden="true" className="size-3.5" />}>
      {label}
    </Badge>
  );
}

/** Distingue el dato introducido por el usuario de la sugerencia generada por IA. */
export function OriginBadge({ origin, confirmed }: { origin: Origin; confirmed: boolean }) {
  if (origin === "user") {
    return (
      <Badge
        className="bg-kind-data/10 text-kind-data ring-kind-data/30"
        icon={<FiUser aria-hidden="true" className="size-3.5" />}
      >
        Dato del usuario
      </Badge>
    );
  }
  return (
    <Badge
      className={
        confirmed
          ? "bg-kind-analysis/10 text-kind-analysis ring-kind-analysis/30"
          : "border border-dashed border-kind-hypothesis/60 bg-kind-hypothesis/10 text-kind-hypothesis ring-0"
      }
      icon={<FiCpu aria-hidden="true" className="size-3.5" />}
    >
      {confirmed ? "Sugerencia de IA · confirmada" : "Sugerencia de IA · pendiente"}
    </Badge>
  );
}
