/**
 * ARCHIVO: research/components/StartResearchButton.tsx
 *
 * ¿Qué es?
 * Es el botón "Buscar información". Al pulsarlo, pide al servidor que empiece una investigación
 * en internet sobre el proyecto.
 *
 * ¿Para qué sirve?
 * Es la acción que convierte una idea estructurada en una búsqueda real. Si algo falla
 * (por ejemplo, se alcanzó el límite diario), muestra el motivo debajo del botón.
 *
 * ¿Quién lo usa?
 * ResearchTab.tsx (en la parte superior) y StructurePanel.tsx (cuando la idea está lista).
 *
 * El texto del botón se puede cambiar desde quien lo usa, con la propiedad "label".
 */

/* Icono de "play" (reproducir) para el botón. */
import { FiPlay } from "react-icons/fi";

/* Aviso de error, botón estándar y convertidor de errores a texto. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { errorMessageFrom } from "../../../lib/formErrors";
/* La acción que inicia la investigación (en la caché). */
import { useStartResearch } from "../queries";
/* Ficha de forma de la búsqueda creada. */
import type { ResearchRun } from "../types";

/**
 * StartResearchButtonProps describe lo que recibe el botón:
 * - projectId: el proyecto para el que se investiga.
 * - label (opcional): el texto del botón. Si no se da, dice "Buscar información".
 * - onStarted (opcional): función que se ejecuta cuando la búsqueda arranca bien.
 *   Quien usa el botón la aprovecha para cambiar de pantalla o mostrar la búsqueda nueva.
 */
/** Contrato de datos StartResearchButtonProps utilizado por investigacion. */
interface StartResearchButtonProps {
  projectId: string;
  label?: string;
  onStarted?: (run: ResearchRun) => void;
}

/**
 * StartResearchButton dibuja el botón y, si falla, el aviso con el motivo.
 *
 * Cómo se usa (ejemplo):
 * <StartResearchButton projectId={project.id} onStarted={() => navigate("investigacion")} />
 */
/** Expone la funcion start research button para el flujo de research. */
export function StartResearchButton({ projectId, label = "Buscar información", onStarted }: StartResearchButtonProps) {
  // La acción de iniciar la búsqueda para este proyecto.
  const start = useStartResearch(projectId);
  return (
    <div className="flex flex-col gap-2">
      <Button
        // Al pulsar, pide iniciar. "onSuccess" avisa a quien usa el botón solo si la búsqueda arrancó.
        onClick={() => start.mutate(undefined, { onSuccess: onStarted })}
        // Mientras arranca, muestra la ruedita y no deja tocarlo otra vez.
        loading={start.isPending}
        icon={<FiPlay aria-hidden="true" />}
      >
        {label}
      </Button>
      {/* Si falló (por ejemplo, límite diario o sin conexión), mostramos el motivo en un aviso. */}
      {start.isError && <Alert>{errorMessageFrom(start.error)}</Alert>}
    </div>
  );
}
