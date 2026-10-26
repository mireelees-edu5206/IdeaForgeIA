import { type FormEvent, useEffect, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiCompass, FiTarget } from "react-icons/fi";
import { useNavigate } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { TextArea } from "../../components/ui/TextArea";
import { TextField } from "../../components/ui/TextField";
import { forgeSceneStore } from "../../lib/forgeSceneStore";
import { errorMessageFrom, fieldErrorsFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { PageHeader } from "./components/PageHeader";
import { RAW_IDEA_MAX_LENGTH, RAW_IDEA_MIN_LENGTH, TITLE_MAX_LENGTH } from "./constants";
import { useCreateProject } from "./queries";

export function validateProject(title: string, rawIdea: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!title.trim()) errors.title = "Este campo no puede estar vacío.";
  if (rawIdea.trim().length < RAW_IDEA_MIN_LENGTH)
    errors.raw_idea = `Escribe una frase breve sobre tu idea (al menos ${RAW_IDEA_MIN_LENGTH} caracteres).`;
  return errors;
}

const PROMPTS = [
  {
    icon: FiTarget,
    title: "El problema",
    text: "¿Qué situación quieres mejorar y a quién le pasa?",
  },
  {
    icon: FiCheckCircle,
    title: "Tu solución",
    text: "¿Qué producto o servicio te imaginas ofrecer?",
  },
  {
    icon: FiCompass,
    title: "Primeros clientes",
    text: "¿Quién podría necesitarlo y en qué lugar empezarías?",
  },
];

export function NewProjectPage() {
  useDocumentTitle("Nuevo proyecto");
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [title, setTitle] = useState("");
  const [rawIdea, setRawIdea] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const trimmedLength = rawIdea.trim().length;
  const forgeProgress = Math.min(100, Math.round((trimmedLength / 180) * 100));
  const litFacets = (title.trim() ? 1 : 0) + (trimmedLength >= RAW_IDEA_MIN_LENGTH ? 1 : 0) + (trimmedLength >= 120 ? 1 : 0);

  useEffect(() => {
    forgeSceneStore.set({
      mode: "composer",
      heat: Math.min(1, 0.25 + forgeProgress / 110),
      litFacets,
    });
  }, [forgeProgress, litFacets]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clientErrors = validateProject(title, rawIdea);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;
    try {
      const project = await createProject.mutateAsync({ title: title.trim(), raw_idea: rawIdea.trim() });
      navigate(`/proyectos/${project.id}`, { replace: true });
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
    }
  }

  const serverError = createProject.isError && Object.keys(errors).length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <LinkButton to="/proyectos" variant="ghost" size="sm" icon={<FiArrowLeft aria-hidden="true" />}>
          Proyectos
        </LinkButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_22rem]">
        <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
          <PageHeader
            eyebrow="PASO 1 DE 5 · EMPEZAR"
            title="Cuéntanos tu idea"
            description="Escribe lo que te gustaría crear. No hace falta que esté completa ni en orden; podrás cambiarla después."
          />

          <p className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-slate-300">
            No necesitas un plan de negocio ni saber de investigación. Una o dos frases son suficientes para empezar.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
            {serverError && <Alert>{errorMessageFrom(createProject.error)}</Alert>}
            <TextField
              label="Nombre del proyecto"
              placeholder="Ej.: Comida saludable para oficinas"
              hint="Es solo para reconocerla; podrás cambiarlo después."
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={errors.title}
              required
            />
            <TextArea
              label="Tu idea"
              rows={8}
              placeholder="Quiero ofrecer comida casera y saludable a personas que trabajan en oficinas y no tienen tiempo para cocinar..."
              maxLength={RAW_IDEA_MAX_LENGTH}
              showCount
              value={rawIdea}
              onChange={(event) => setRawIdea(event.target.value)}
              error={errors.raw_idea}
              hint={`Mínimo ${RAW_IDEA_MIN_LENGTH} caracteres. Puedes completar los detalles más adelante.`}
              required
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <LinkButton to="/proyectos" variant="ghost">
                Cancelar
              </LinkButton>
              <Button type="submit" loading={createProject.isPending} icon={<FiArrowRight aria-hidden="true" />}>
                Crear y continuar
              </Button>
            </div>
          </form>
        </GlassPanel>

        <aside aria-label="Guía para redactar la idea" className="flex flex-col gap-3.5">
          <GlassPanel className="flex flex-col gap-3 rounded-2xl p-5">
            <p className="section-eyebrow">NO NECESITAS TENERLO TODO CLARO</p>
            <h2 className="text-base font-semibold">Estas preguntas pueden ayudarte</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Responde las que puedas. Si todavía no sabes algo, puedes dejarlo para después.
            </p>
          </GlassPanel>

          {PROMPTS.map(({ icon: Icon, title: itemTitle, text }) => (
            <GlassPanel key={itemTitle} className="tilt-3d flex items-start gap-3.5 rounded-2xl p-4">
              <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">{itemTitle}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{text}</p>
              </div>
            </GlassPanel>
          ))}
        </aside>
      </div>
    </div>
  );
}
