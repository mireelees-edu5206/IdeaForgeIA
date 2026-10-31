/**
 * ARCHIVO: projects/components/badges.tsx
 *
 * ¿Qué es?
 * Son dos "stickers" pequeños que se pegan en la pantalla para decir algo de un vistazo:
 * - StatusBadge: en qué etapa está un proyecto (por ejemplo "Lista para investigar").
 * - OriginBadge: si un dato lo escribió la persona o lo propuso la inteligencia artificial,
 *   y si la persona ya lo aceptó o todavía no.
 *
 * ¿Para qué sirve?
 * Para que la persona distinga de un vistazo lo que es suyo de lo que es una propuesta de la IA.
 * Esa diferencia es importante: una sugerencia de IA no se trata como un hecho hasta que se confirma.
 *
 * ¿Quién lo usa?
 * ProjectCard.tsx (StatusBadge) y StructurePanel.tsx y AttributeSection.tsx (OriginBadge).
 */

/* Dos iconos: "FiCpu" (chip, para la IA) y "FiUser" (persona). */
import { FiCpu, FiUser } from "react-icons/fi";

/* La etiqueta base de la app (la forma redondeada); aquí solo le ponemos texto, color e icono. */
import { Badge } from "../../../components/ui/Badge";
/* El diccionario de etapas, con nombre, colores e icono de cada una. */
import { STATUS_META } from "../constants";
/* Tipos de origen (IA o usuario) y de etapa. */
import type { Origin, ProjectStatus } from "../types";

/**
 * StatusBadge muestra la etapa de un proyecto con su color e icono.
 *
 * Recibe: status (la etapa actual).
 * Devuelve: una etiqueta con el texto y el color que vienen de STATUS_META.
 */
/** Expone la funcion status badge para el flujo de projects. */
export function StatusBadge({ status }: { status: ProjectStatus }) {
  // Sacamos del diccionario el texto, el color y el icono de esta etapa.
  // "icon: Icon" renombra la propiedad a "Icon" con mayúscula, porque en React un componente debe empezar con mayúscula.
  const { label, className, icon: Icon } = STATUS_META[status];
  return (
    <Badge className={className} icon={<Icon aria-hidden="true" className="size-3.5" />}>
      {label}
    </Badge>
  );
}

/**
 * OriginBadge muestra de dónde viene un dato y si ya fue confirmado. Hay tres casos:
 * 1. Lo escribió la persona ("user"): etiqueta "Dato del usuario", azul de datos.
 * 2. Lo propuso la IA y ya se confirmó: etiqueta "Sugerencia de IA · confirmada", azul de análisis.
 * 3. Lo propuso la IA y todavía NO se confirmó: etiqueta punteada color ámbar "pendiente",
 *    para que se vea que es una propuesta que aún hay que revisar.
 *
 * Recibe:
 * - origin: "user" o "ai".
 * - confirmed: si la persona ya lo aceptó (solo importa cuando el origen es la IA).
 */
/** Distingue el dato introducido por el usuario de la sugerencia generada por IA. */
export function OriginBadge({ origin, confirmed }: { origin: Origin; confirmed: boolean }) {
  // Caso 1: lo escribió la persona. No hace falta preguntar si está confirmado, ya es suyo.
  /** Rama condicional: origin === "user". */
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
  // Casos 2 y 3: es una sugerencia de la IA. El estilo cambia según esté confirmada o no.
  return (
    <Badge
      className={
        confirmed
          // Confirmada: un estilo sólido azul.
          ? "bg-kind-analysis/10 text-kind-analysis ring-kind-analysis/30"
          // Pendiente: un borde punteado color ámbar, sin anillo. Se ve "provisional" a propósito.
          : "border border-dashed border-kind-hypothesis/60 bg-kind-hypothesis/10 text-kind-hypothesis ring-0"
      }
      icon={<FiCpu aria-hidden="true" className="size-3.5" />}
    >
      {confirmed ? "Sugerencia de IA · confirmada" : "Sugerencia de IA · pendiente"}
    </Badge>
  );
}
