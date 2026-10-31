/**
 * ARCHIVO: projects/components/EmptyState.tsx
 *
 * ¿Qué es?
 * Es el mensaje que aparece cuando una lista o pantalla todavía no tiene nada. En lugar de dejar
 * un espacio vacío y confuso, muestra un icono grande, un título, una explicación y, si hace falta,
 * un botón para hacer lo siguiente.
 *
 * ¿Para qué sirve?
 * Para orientar a la persona: le dice qué falta y qué puede hacer para avanzar.
 * Ejemplo: "Aún no hay proyectos" + botón "Crear mi primera idea".
 *
 * ¿Quién lo usa?
 * Las pantallas de lista (proyectos, hallazgos, fuentes...) cuando están vacías.
 */

/* "ReactNode" es cualquier contenido que React puede dibujar (por ejemplo, un botón). */
import type { ReactNode } from "react";
/* El tipo de un icono de react-icons. */
import type { IconType } from "react-icons";

/* La tarjeta de cristal que enmarca el mensaje. */
import { GlassPanel } from "../../../components/ui/GlassPanel";

/**
 * EmptyStateProps describe lo que recibe el mensaje:
 * - icon: el dibujito grande que se muestra arriba.
 * - title: el título corto (por ejemplo "Aún no hay hallazgos").
 * - description: la explicación de qué hacer o qué falta.
 * - action (opcional): un botón o enlace para avanzar.
 */
/** Contrato de datos EmptyStateProps utilizado por proyectos. */
interface EmptyStateProps {
  icon: IconType;
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * EmptyState dibuja el mensaje de "todavía no hay nada" centrado, con su icono y su botón si lo hay.
 *
 * Cómo se usa (ejemplo):
 * <EmptyState icon={FiFolder} title="Aún no hay proyectos" description="Crea tu primera idea." action={<LinkButton to="/proyectos/nuevo">Nueva idea</LinkButton>} />
 */
/** Expone la funcion empty state para el flujo de projects. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    // Tarjeta de cristal centrada en columna. "stage-3d" le da su tinte, "px-6 py-14" da mucho espacio.
    <GlassPanel className="stage-3d flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
      {/* El icono dentro de un cuadrito levantado. "tilt-3d" le da un leve movimiento al pasar el mouse. */}
      <span className="neo-raised tilt-3d grid size-16 place-items-center rounded-2xl ring-1 ring-accent-cyan/25">
        {/* "aria-hidden" esconde el dibujo de los lectores de pantalla: el título ya explica todo. */}
        <Icon aria-hidden="true" className="size-7 text-accent-cyan" />
      </span>
      {/* El título, como encabezado de sección. */}
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      {/* La explicación. "max-w-md" evita líneas demasiado largas. */}
      <p className="max-w-md text-sm leading-relaxed text-slate-300">{description}</p>
      {/* El botón de siguiente paso. "action &&" significa: si hay acción, dibújala; si no, no dibujes nada. */}
      {action && <div className="mt-3">{action}</div>}
    </GlassPanel>
  );
}
