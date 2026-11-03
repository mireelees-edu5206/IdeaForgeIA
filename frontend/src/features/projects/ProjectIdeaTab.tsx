/**
 * ARCHIVO: frontend/src/features/projects/ProjectIdeaTab.tsx
 *
 * ¿Qué es?
 * La pestaña "Idea" dentro de un proyecto. Es la primera pantalla que ve la persona al abrir su proyecto.
 *
 * ¿Para qué sirve?
 * Para que la persona escriba y revise su idea, y complete los datos que necesita la investigación:
 * - Paso 1 (obligatorio): problema, solución y segmento de clientes.
 * - Opcional: canales, precios, zona de operación y otros detalles que ya conozca.
 * - Lateral: el panel de estructura, que dice si la idea ya está lista para investigar.
 *
 * ¿Cómo se ve?
 * - En pantallas grandes (lg), la idea ocupa la columna izquierda y el panel de estructura queda
 *   fijo a la derecha mientras se hace scroll.
 * - En pantallas pequeñas, todo se apila en una sola columna.
 *
 * ¿Quién lo usa?
 * features/projects/routes.tsx la muestra como la pestaña por defecto del proyecto.
 * Toma los datos del proyecto con useProjectOutlet, que los obtiene del archivo outlet.ts.
 */
import { AttributeSection } from "./components/AttributeSection";
import { IdeaSection } from "./components/IdeaSection";
import { StructurePanel } from "./components/StructurePanel";
import { ATTRIBUTE_TYPES, REQUIRED_ATTRIBUTES } from "./constants";
import { useProjectOutlet } from "./outlet";

/**
 * Los tipos de atributo que NO son obligatorios: todos los de ATTRIBUTE_TYPES menos los requeridos.
 *
 * "filter" crea una lista nueva con los que cumplen la condición. "includes" pregunta si la lista
 * de requeridos contiene ese tipo. El "!" invierte la respuesta: nos quedamos con los que NO son requeridos.
 */
const OPTIONAL_ATTRIBUTES = ATTRIBUTE_TYPES.filter((type) => !REQUIRED_ATTRIBUTES.includes(type));

/**
 * Pestaña "Idea" de un proyecto. No recibe props: obtiene el proyecto del contexto de la ruta.
 */
export function ProjectIdeaTab() {
  // El proyecto actual (con sus atributos) que la ruta padre ya cargó.
  const { project } = useProjectOutlet();
  /**
   * Devuelve solo los valores de un tipo de atributo, por ejemplo todos los "problema" del proyecto.
   * Cada sección de la pantalla usa esta función para mostrar sus propios valores.
   */
  const valuesOf = (type: (typeof ATTRIBUTE_TYPES)[number]) =>
    project.attributes.filter((attribute) => attribute.attribute_type === type);

  return (
    <div className="flex flex-col gap-6">
      {/* Fila superior: la idea a la izquierda (1.3 partes) y el panel de estructura a la derecha (21 rem). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_21rem]">
        {/* "key" con el texto de la idea hace que el componente se reinicie cuando la idea cambia en el servidor. */}
        <IdeaSection key={project.raw_idea} project={project} />
        {/* En pantallas grandes, el panel se queda visible al hacer scroll (sticky). */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <StructurePanel project={project} />
        </div>
      </div>

      {/* Paso 1: los tres datos obligatorios. "aria-labelledby" conecta la sección con su título para lectores de pantalla. */}
      <section aria-labelledby="nucleo-idea" className="flex flex-col gap-3">
        <div>
          {/* La etiqueta pequeña de arriba del título, en mayúsculas, indica el paso. */}
          <p className="section-eyebrow">PASO 1 · INFORMACIÓN BÁSICA</p>
          <h2 id="nucleo-idea" className="text-lg font-semibold">
            Cuéntanos estos tres puntos
          </h2>
          <p className="max-w-2xl text-sm text-slate-400">
            Para buscar información útil necesitamos saber qué problema resuelves, cómo y para quién.
          </p>
        </div>
        {/* Una tarjeta por cada tipo obligatorio: en pantallas grandes, las tres en una fila. */}
        <div className="grid gap-4 lg:grid-cols-3">
          {REQUIRED_ATTRIBUTES.map((type) => (
            <AttributeSection key={type} projectId={project.id} type={type} values={valuesOf(type)} required />
          ))}
        </div>
      </section>

      {/* Opcional: detalles que mejoran los resultados. No bloquean la investigación. */}
      <section aria-labelledby="contexto-idea" className="flex flex-col gap-3">
        <div>
          <p className="section-eyebrow">OPCIONAL · PARA OBTENER MEJORES RESULTADOS</p>
          <h2 id="contexto-idea" className="text-lg font-semibold">
            Añade otros detalles que ya conozcas
          </h2>
          <p className="max-w-2xl text-sm text-slate-400">
            Canales, precios o zona de operación ayudan a encontrar información más cercana a tu caso.
          </p>
        </div>
        {/* Dos columnas en pantallas medianas. "required={false}" marca estas tarjetas como opcionales. */}
        <div className="grid gap-4 md:grid-cols-2">
          {OPTIONAL_ATTRIBUTES.map((type) => (
            <AttributeSection key={type} projectId={project.id} type={type} values={valuesOf(type)} required={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
