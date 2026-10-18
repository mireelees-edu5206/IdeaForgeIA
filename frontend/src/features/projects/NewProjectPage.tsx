import { type FormEvent, useEffect, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiCompass, FiTarget, FiZap } from "react-icons/fi";
import { useNavigate } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CrucibleGlyph, FacetTriadGlyph } from "../../components/ui/ForgeGlyphs";
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
    errors.raw_idea = `Describe tu idea con al menos ${RAW_IDEA_MIN_LENGTH} caracteres.`;
  return errors;
}

const PROMPTS = [
  {
    icon: FiTarget,
    title: "Faceta I · Problema y cliente",
    text: "¿Qué dolor concreto existe hoy y quién lo sufre con más frecuencia?",
  },
  {
    icon: FiCheckCircle,
    title: "Faceta II · Propuesta y modelo",
    text: "¿Qué solución ofreces, por qué canal llegarás y cómo piensas cobrar?",
  },
  {
    icon: FiCompass,
    title: "Faceta III · Alcance y rivales",
    text: "¿En qué ciudad o región empezarías y qué alternativas usan hoy?",
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
    <div className="flex animate-fade-up flex-col gap-6">
      <div>
        <LinkButton to="/proyectos" variant="ghost" size="sm" icon={<FiArrowLeft aria-hidden="true" />}>
          Proyectos
        </LinkButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_22rem]">
        <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
          <PageHeader
            eyebrow="Paso 01 · Alimentar el crisol"
            title="Nuevo proyecto"
            description="Empieza por contar tu idea con tus palabras. En el siguiente paso la estructurarás."
          />

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
            {serverError && <Alert>{errorMessageFrom(createProject.error)}</Alert>}
            <TextField
              label="Nombre del proyecto"
              placeholder="Ej.: Agro Conecta"
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={errors.title}
              required
            />
            <TextArea
              label="Tu idea"
              rows={8}
              placeholder="¿Qué problema ves? ¿Para quién? ¿Cómo lo resolverías? ¿Dónde operarías?"
              maxLength={RAW_IDEA_MAX_LENGTH}
              showCount
              value={rawIdea}
              onChange={(event) => setRawIdea(event.target.value)}
              error={errors.raw_idea}
              hint={`Entre ${RAW_IDEA_MIN_LENGTH} y ${RAW_IDEA_MAX_LENGTH.toLocaleString("es")} caracteres. No hace falta que esté ordenada.`}
              required
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <LinkButton to="/proyectos" variant="ghost">
                Cancelar
              </LinkButton>
              <Button type="submit" loading={createProject.isPending} icon={<FiZap aria-hidden="true" />}>
                Crear proyecto
              </Button>
            </div>
          </form>
        </GlassPanel>

        <aside aria-label="Guía para redactar la idea" className="flex flex-col gap-3.5">
          {/* Medidor vivo de condensación del núcleo */}
          <GlassPanel className="stage-3d flex flex-col gap-3 rounded-3xl p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech inline-flex items-center gap-2 text-xs font-semibold text-accent-cyan uppercase">
                <CrucibleGlyph className="size-4" /> Condensación del núcleo
              </span>
              <FacetTriadGlyph lit={litFacets} />
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {trimmedLength < RAW_IDEA_MIN_LENGTH
                ? `Añade ${RAW_IDEA_MIN_LENGTH - trimmedLength} caracteres más para encender la primera fusión.`
                : trimmedLength < 120
                  ? "Base mínima lista. Añade contexto de cliente o ubicación para enriquecer las consultas."
                  : "Densidad óptima para extraer atributos y formular preguntas de investigación."}
            </p>
            <div className="neo-inset h-2 overflow-hidden rounded-full">
              <div
                className="filament-line h-full rounded-full transition-[width] duration-300"
                style={{ width: `${Math.max(forgeProgress, 6)}%` }}
              />
            </div>
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
