/**
 * ARCHIVO: frontend/src/features/projects/NewProjectPage.tsx
 *
 * ¿Qué es?
 * La pantalla "Cuéntanos tu idea": el formulario para crear un proyecto nuevo.
 * Es el primer paso de la experiencia (la barra dice "PASO 1 DE 5").
 *
 * ¿Qué se ve en pantalla?
 * - Arriba, un enlace para volver a la lista de proyectos.
 * - En el lado izquierdo, el formulario con dos campos: el nombre del proyecto y la descripción de la idea.
 * - En el lado derecho (o debajo, en celular), una guía con tres preguntas que ayudan a redactar:
 *   el problema, la solución y los primeros clientes.
 * - Una escena 3D decorativa que reacciona mientras escribes: entre más texto, más "calor" y más
 *   facetas iluminadas. Se controla con forgeSceneStore.
 *
 * ¿Qué pasa al enviar?
 * 1. validateProject revisa en el navegador que el nombre no esté vacío y que la idea tenga el
 *    mínimo de caracteres. Si algo falla, muestra el mensaje debajo del campo y no envía nada.
 * 2. Si pasa, crea el proyecto con useCreateProject y navega a su página de detalle.
 * 3. Si el servidor rechaza algo, sus mensajes aparecen en los campos correspondientes.
 *
 * ¿Quién lo usa?
 * app/router.tsx (ruta "proyectos/nuevo").
 */
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

/**
 * Revisa el formulario en el navegador antes de enviarlo al servidor.
 *
 * Devuelve un objeto con un mensaje por cada campo que tenga problemas. Si el objeto está vacío,
 * el formulario es válido. Se exporta para poder probarla sin dibujar la pantalla.
 *
 * @param title El nombre del proyecto que escribió la persona.
 * @param rawIdea La descripción de la idea.
 */
export function validateProject(title: string, rawIdea: string): Record<string, string> {
  const errors: Record<string, string> = {};
  // "trim" quita espacios; un nombre hecho solo de espacios cuenta como vacío.
  if (!title.trim()) errors.title = "Este campo no puede estar vacío.";
  // La idea debe tener al menos RAW_IDEA_MIN_LENGTH caracteres, sin contar espacios sobrantes.
  if (rawIdea.trim().length < RAW_IDEA_MIN_LENGTH)
    errors.raw_idea = `Escribe una frase breve sobre tu idea (al menos ${RAW_IDEA_MIN_LENGTH} caracteres).`;
  return errors;
}

/**
 * Las tres preguntas de la guía lateral. Cada una tiene un icono, un título y una pregunta de ejemplo.
 * Para cambiar los textos de la guía, edita esta lista.
 */
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

/**
 * Pantalla para crear un proyecto nuevo. No recibe props.
 */
export function NewProjectPage() {
  // Pone "Nuevo proyecto" en el título de la pestaña.
  useDocumentTitle("Nuevo proyecto");
  // navigate permite cambiar de página por código (por ejemplo, al crear el proyecto).
  const navigate = useNavigate();
  // Hook de React Query para crear el proyecto en el servidor.
  const createProject = useCreateProject();
  // Lo que la persona escribe en cada campo. Cada cambio vuelve a dibujar la pantalla.
  const [title, setTitle] = useState("");
  const [rawIdea, setRawIdea] = useState("");
  // Mensajes de error por campo, por ejemplo { title: "..." }.
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cuántos caracteres útiles (sin espacios sobrantes) tiene la idea.
  const trimmedLength = rawIdea.trim().length;
  // Porcentaje de avance hacia 180 caracteres, sin pasar de 100. Alimenta la escena 3D.
  const forgeProgress = Math.min(100, Math.round((trimmedLength / 180) * 100));
  // Cuántas "facetas" de la escena se iluminan: una por el nombre, una por la idea mínima y una por una idea más detallada (120 o más).
  const litFacets =
    (title.trim() ? 1 : 0) + (trimmedLength >= RAW_IDEA_MIN_LENGTH ? 1 : 0) + (trimmedLength >= 120 ? 1 : 0);

  // Cada vez que cambia el avance o las facetas, se actualiza la escena 3D decorativa.
  // La lista de dependencias [forgeProgress, litFacets] indica cuándo volver a ejecutar el efecto.
  useEffect(() => {
    forgeSceneStore.set({
      // "composer" es el modo de la escena para formularios de escritura.
      mode: "composer",
      // "heat" es la intensidad del brillo: empieza en 0.25 y sube hasta 1 según se escribe.
      heat: Math.min(1, 0.25 + forgeProgress / 110),
      litFacets,
    });
  }, [forgeProgress, litFacets]);

  /**
   * Se ejecuta al enviar el formulario.
   *
   * Valida en el navegador. Si todo está bien, crea el proyecto y navega a su página.
   * Usa replace: true para que "atrás" no regrese a este formulario ya enviado.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Evita que el navegador recargue la página al enviar el formulario.
    event.preventDefault();
    const clientErrors = validateProject(title, rawIdea);
    setErrors(clientErrors);
    // Si hay errores de validación, no se envía nada al servidor.
    if (Object.keys(clientErrors).length > 0) return;
    try {
      // Envía el nombre y la idea sin espacios sobrantes.
      const project = await createProject.mutateAsync({ title: title.trim(), raw_idea: rawIdea.trim() });
      navigate(`/proyectos/${project.id}`, { replace: true });
    } catch (error) {
      // Si el servidor rechazó algún campo, se muestra en ese campo.
      setErrors(fieldErrorsFrom(error));
    }
  }

  // Hay un error del servidor que no corresponde a ningún campo. Se muestra como alerta general arriba del formulario.
  const serverError = createProject.isError && Object.keys(errors).length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Enlace para volver a la lista de proyectos. */}
      <div>
        <LinkButton to="/proyectos" variant="ghost" size="sm" icon={<FiArrowLeft aria-hidden="true" />}>
          Proyectos
        </LinkButton>
      </div>

      {/* Dos columnas en pantallas grandes: formulario (más ancho) y guía (más estrecha). */}
      <div className="grid gap-6 lg:grid-cols-[1.35fr_22rem]">
        <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
          <PageHeader
            eyebrow="PASO 1 DE 5 · EMPEZAR"
            title="Cuéntanos tu idea"
            description="Escribe lo que te gustaría crear. No hace falta que esté completa ni en orden; podrás cambiarla después."
          />

          {/* Aviso que quita la presión de tener todo listo. */}
          <p className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-slate-300">
            No necesitas un plan de negocio ni saber de investigación. Una o dos frases son suficientes para empezar.
          </p>

          {/* "noValidate" desactiva la validación automática del navegador, porque la validamos nosotros con mensajes en español. */}
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
            {/* Botones: en celular van apilados (Cancelar arriba), en pantallas grandes van en una fila a la derecha. */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <LinkButton to="/proyectos" variant="ghost">
                Cancelar
              </LinkButton>
              {/* "loading" muestra un indicador mientras se crea el proyecto y evita enviarlo dos veces. */}
              <Button type="submit" loading={createProject.isPending} icon={<FiArrowRight aria-hidden="true" />}>
                Crear y continuar
              </Button>
            </div>
          </form>
        </GlassPanel>

        {/* Guía lateral. "aside" indica que es contenido de apoyo, no el contenido principal. */}
        <aside aria-label="Guía para redactar la idea" className="flex flex-col gap-3.5">
          <GlassPanel className="flex flex-col gap-3 rounded-2xl p-5">
            <p className="section-eyebrow">NO NECESITAS TENERLO TODO CLARO</p>
            <h2 className="text-base font-semibold">Estas preguntas pueden ayudarte</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Responde las que puedas. Si todavía no sabes algo, puedes dejarlo para después.
            </p>
          </GlassPanel>

          {/* Una tarjeta por cada pregunta de PROMPTS. "Icon" se renombra para poder usarlo como etiqueta de JSX. */}
          {PROMPTS.map(({ icon: Icon, title: itemTitle, text }) => (
            <GlassPanel key={itemTitle} className="tilt-3d flex items-start gap-3.5 rounded-2xl p-4">
              <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
                {/* aria-hidden: el icono es decorativo; el lector de pantalla lee solo el texto. */}
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
