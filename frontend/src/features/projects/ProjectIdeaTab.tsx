import { AttributeSection } from "./components/AttributeSection";
import { IdeaSection } from "./components/IdeaSection";
import { StructurePanel } from "./components/StructurePanel";
import { ATTRIBUTE_TYPES, REQUIRED_ATTRIBUTES } from "./constants";
import { useProjectOutlet } from "./outlet";

const OPTIONAL_ATTRIBUTES = ATTRIBUTE_TYPES.filter((type) => !REQUIRED_ATTRIBUTES.includes(type));

export function ProjectIdeaTab() {
  const { project } = useProjectOutlet();
  const valuesOf = (type: (typeof ATTRIBUTE_TYPES)[number]) =>
    project.attributes.filter((attribute) => attribute.attribute_type === type);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_21rem]">
        <IdeaSection key={project.raw_idea} project={project} />
        <div className="lg:sticky lg:top-24 lg:self-start">
          <StructurePanel project={project} />
        </div>
      </div>

      <section aria-labelledby="nucleo-idea" className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-accent-cyan uppercase">Núcleo obligatorio</p>
          <h2 id="nucleo-idea" className="text-lg font-semibold">
            Atributos esenciales para investigar
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {REQUIRED_ATTRIBUTES.map((type) => (
            <AttributeSection key={type} projectId={project.id} type={type} values={valuesOf(type)} required />
          ))}
        </div>
      </section>

      <section aria-labelledby="contexto-idea" className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-accent-violet uppercase">Contexto estratégico</p>
          <h2 id="contexto-idea" className="text-lg font-semibold">
            Atributos complementarios de la idea
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {OPTIONAL_ATTRIBUTES.map((type) => (
            <AttributeSection key={type} projectId={project.id} type={type} values={valuesOf(type)} required={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
