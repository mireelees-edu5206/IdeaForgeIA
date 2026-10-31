/**
 * ARCHIVO: chat/ChatTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Pregunta sobre tu idea" (el asistente). Es un chat: la persona escribe una pregunta,
 * el asistente responde usando la información guardada del proyecto, y cada respuesta muestra los
 * resultados y las fuentes en que se apoya.
 *
 * ¿Para qué sirve?
 * Permite hacer preguntas sobre la idea sin tener que leer todos los resultados. Las respuestas
 * se pueden verificar, porque cada una lleva sus resultados citados y sus fuentes.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "asistente").
 *
 * Qué NO hace el asistente (lo dice la pantalla): no busca nada nuevo en internet; solo usa lo que ya
 * está guardado en el proyecto.
 *
 * Qué ve la persona:
 * - Si no hay mensajes: un mensaje de bienvenida con 4 preguntas rápidas que llenan la casilla.
 * - Los mensajes: cada uno como una burbuja. Las respuestas del asistente traen sus resultados citados.
 * - Mientras espera: un aviso "Revisando la información del proyecto…".
 * - Si falla: un aviso de error, y el texto vuelve a la casilla para no perderlo.
 * - Un botón "Nueva conversación" que borra la pantalla (no borra nada del servidor).
 */

/* "FormEvent" es el tipo del evento de enviar. "useState" guarda la conversación, la pregunta, si espera y el error. */
import { type FormEvent, useState } from "react";
/* Iconos: mensaje, basura (nueva conversación), enlace externo y rayo (preguntas rápidas). */
import { FiExternalLink, FiMessageCircle, FiTrash2, FiZap } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { TextArea } from "../../components/ui/TextArea";
/* Une clases de estilo y convierte errores a texto. */
import { cn } from "../../lib/cn";
import { errorMessageFrom } from "../../lib/formErrors";
/* Textos de confianza y postura (carpeta de resultados). */
import { CONFIDENCE_META, STANCE_META } from "../findings/constants";
/* El proyecto que entregó el detalle a esta pestaña. */
import { useProjectOutlet } from "../projects/outlet";
/* Nombres de temas y validación de enlaces seguros (carpeta de investigación). */
import { CATEGORY_LABELS, safeHref } from "../research/constants";
/* La función que envía el mensaje al servidor. */
import { chatApi } from "./api";
/* Tipos de cada turno de la conversación y de las referencias citadas. */
import type { ChatFindingReference, ChatTurn } from "./types";

/**
 * MAX_MESSAGE_LENGTH es el largo máximo de una pregunta (2000 caracteres). Si cambias este número,
 * revisa que el servidor acepte el mismo largo (en chat/schemas.py).
 */
/** Define MAX_MESSAGE_LENGTH para el bloque de chat. */
const MAX_MESSAGE_LENGTH = 2000;
/**
 * MAX_HISTORY_CHARS es el límite de caracteres del historial que se envía al asistente (5000).
 * Este límite existe SOLO en el frontend. El servidor acepta hasta 14 turnos y hasta 3000 caracteres
 * por turno (chat/schemas.py). Si el historial pasa de 5000, se quitan los mensajes más viejos (ver trimHistory).
 */
/** Define MAX_HISTORY_CHARS para el bloque de chat. */
const MAX_HISTORY_CHARS = 5000;

/**
 * QUICK_PROMPTS son las cuatro preguntas de ejemplo de la pantalla de bienvenida. Al tocar una,
 * se copia en la casilla (no se envía sola). Cambia aquí los textos para cambiar las sugerencias.
 */
/** Define QUICK_PROMPTS para el bloque de chat. */
const QUICK_PROMPTS = [
  "¿Qué sabemos de los posibles clientes?",
  "¿Qué problemas o riesgos debería considerar?",
  "¿Qué debería probar primero?",
  "¿Qué dudas siguen abiertas?",
];

/**
 * VisibleTurn es un mensaje de la pantalla: un turno normal (rol y texto) que además puede traer
 * "references" (los resultados citados). Solo las respuestas del asistente llevan references.
 * El "?" significa que el campo es opcional.
 */
/** Contrato de datos VisibleTurn utilizado por chat. */
interface VisibleTurn extends ChatTurn {
  references?: ChatFindingReference[];
}

/**
 * ChatTab dibuja el chat completo y maneja el envío de preguntas.
 */
/** Expone la funcion chat tab para el flujo de chat. */
export function ChatTab() {
  // El proyecto que entregó el detalle.
  const { project } = useProjectOutlet();
  // La conversación completa que se ve en pantalla. Empieza vacía.
  const [messages, setMessages] = useState<VisibleTurn[]>([]);
  // Lo que la persona está escribiendo en la casilla.
  const [question, setQuestion] = useState("");
  // true mientras se espera la respuesta del asistente.
  const [pending, setPending] = useState(false);
  // El último error (o null si no hay). "unknown" porque puede ser cualquier tipo de error.
  const [error, setError] = useState<unknown>(null);

  /**
   * submit se ejecuta al enviar la pregunta. Hace cuatro cosas:
   * 1. Quita espacios y revisa que no esté vacía ni que ya haya una pregunta en curso.
   * 2. Arma el historial reciente (los últimos 12 mensajes, limitado por trimHistory).
   * 3. Muestra de inmediato la pregunta y pide la respuesta al servidor.
   * 4. Si llega la respuesta, la muestra con sus referencias. Si falla, quita la pregunta de la
   *    pantalla y la devuelve a la casilla, para que no se pierda.
   */
  /** Gestiona submit de chat. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    // Quitamos los espacios de los extremos.
    const message = question.trim();
    // No enviamos si está vacía o si ya hay una pregunta esperando respuesta.
    /** Rama condicional: !message || pending. */
    if (!message || pending) return;

    // Los últimos 12 mensajes de la conversación, recortados por trimHistory.
    const history = trimHistory(messages.slice(-12), message);
    // Limpiamos el error anterior, marcamos que espera y vaciamos la casilla.
    setError(null);
    setPending(true);
    setQuestion("");
    // Mostramos la pregunta de inmediato, sin esperar la respuesta.
    setMessages((current) => [...current, { role: "user", content: message }]);
    // Pedimos la respuesta. Si falla, entramos al "catch".
    /** Maneja fallos de la operacion del bloque chat. */
    try {
      const reply = await chatApi.sendMessage(project.id, { message, history });
      // Agregamos la respuesta, con sus resultados citados.
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: reply.answer,
          references: reply.references,
        },
      ]);
    } catch (cause) {
      // Quitamos la última burbuja (la pregunta), devolvemos el texto a la casilla y mostramos el error.
      setMessages((current) => current.slice(0, -1));
      setQuestion(message);
      setError(cause);
    } finally {
      // Pase lo que pase (bien o mal), ya no está esperando.
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* La cabecera: título y explicación de lo que puede y no puede hacer el asistente. */}
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Pregunta sobre tu idea</h2>
        <p className="max-w-3xl text-sm text-slate-400">
          Pregunta lo que quieras. Puedo usar la información y las fuentes guardadas en este proyecto, pero no hago búsquedas nuevas en internet.
        </p>
      </header>

      {/* La tarjeta grande que contiene la conversación y la casilla de escribir. */}
      <GlassPanel className="stage-3d flex min-h-[26rem] flex-col gap-4 rounded-3xl p-4 sm:p-6">
        {/* La zona de mensajes. "role=log" y "aria-live" hacen que los lectores de pantalla anuncien los mensajes nuevos. */}
        <div
          role="log"
          aria-label="Conversación del proyecto"
          aria-live="polite"
          className="flex max-h-[60vh] min-h-72 flex-col gap-4 overflow-y-auto pr-1"
        >
          {/* Si no hay mensajes, la bienvenida con las preguntas rápidas. Si hay, las burbujas. */}
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
              <span className="neo-raised tilt-3d flex size-16 items-center justify-center rounded-2xl text-accent-cyan">
                <FiMessageCircle aria-hidden="true" className="size-7" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">¿Por dónde empezamos?</h3>
                <p className="mt-1 max-w-md text-sm text-slate-400">
                  Elige una pregunta o escribe la tuya. Si no hay información suficiente, te lo diré.
                </p>
              </div>
              {/* Las preguntas rápidas. Al tocar una, se copia en la casilla (no se envía sola). */}
              <div className="mt-2 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setQuestion(prompt)}
                    className="neo-raised tilt-3d jelly flex items-start gap-2.5 rounded-2xl p-3 text-left text-xs font-medium text-slate-200 hover:text-accent-cyan"
                  >
                    <FiZap aria-hidden="true" className="mt-0.5 shrink-0 text-accent-violet" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Una burbuja por cada mensaje. La clave combina el número y el rol, para que React distinga cada uno.
            messages.map((message, index) => (
              <ChatBubble key={`${index}-${message.role}`} message={message} />
            ))
          )}
          {/* El aviso mientras el asistente responde. El punto parpadea (animate-pulse). */}
          {pending && (
            <p role="status" className="flex items-center gap-2 text-sm text-accent-cyan">
              <span className="size-2 animate-pulse rounded-full bg-current" /> Revisando la información del proyecto…
            </p>
          )}
        </div>

        {/* El error del último intento, si lo hubo. */}
        {error != null && <Alert>{errorMessageFrom(error)}</Alert>}

        {/* El formulario: la casilla y los botones. */}
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-slate-400/15 pt-4">
          {/* La casilla de la pregunta. Se bloquea mientras espera la respuesta. */}
          <TextArea
            label="Tu mensaje"
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            showCount
            value={question}
            placeholder="Ej.: ¿Quiénes podrían comprar este producto y qué información tenemos sobre ellos?"
            onChange={(event) => setQuestion(event.target.value)}
            disabled={pending}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {/* "Nueva conversación" solo aparece si hay mensajes. Solo borra la pantalla, no el servidor. */}
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<FiTrash2 aria-hidden="true" />}
                disabled={pending}
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
              >
                Nueva conversación
              </Button>
            )}
            {/* Enviar: se desactiva si la casilla está vacía (solo espacios cuenta como vacía). */}
            <Button type="submit" size="sm" loading={pending} disabled={!question.trim()}>
              Enviar
            </Button>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}

/**
 * trimHistory prepara el historial que se envía al asistente. Quita los mensajes más viejos
 * hasta cumplir dos límites: como máximo 14 turnos, y como máximo 5000 caracteres entre
 * el historial y la pregunta nueva. Si el mensaje más viejo es una pregunta seguida de su
 * respuesta, las quita juntas, para no dejar una respuesta sin su pregunta.
 *
 * Recibe: messages (los turnos previos) y message (la pregunta nueva, que cuenta en el total).
 * Devuelve: la lista de turnos (solo rol y texto) que se envía al servidor.
 */
/** Gestiona trim history de chat. */
function trimHistory(messages: ChatTurn[], message: string): ChatTurn[] {
  // Dejamos solo rol y texto de cada turno (quitamos los campos extra, como las referencias).
  const history = messages.map(({ role, content }) => ({ role, content }));
  // El total de caracteres: la pregunta nueva más todos los turnos del historial.
  let total = message.length + history.reduce((sum, turn) => sum + turn.content.length, 0);
  // Mientras haya turnos y se pase de algún límite, quitamos los más viejos.
  /** Recorre los elementos del bloque chat. */
  while (history.length > 0 && (history.length > 14 || total > MAX_HISTORY_CHARS)) {
    // "dropPair" es true si el primero es pregunta y el segundo es respuesta: en ese caso se quitan los dos.
    const dropPair = history[0]?.role === "user" && history[1]?.role === "assistant";
    // "splice(0, n)" quita los primeros n turnos del arreglo y los devuelve.
    const removed = history.splice(0, dropPair ? 2 : 1);
    // Restamos del total los caracteres de lo que quitamos.
    total -= removed.reduce((sum, turn) => sum + turn.content.length, 0);
  }
  return history;
}

/**
 * ChatBubble dibuja una burbuja de la conversación. Las del asistente van a la izquierda con
 * su lista de resultados citados; las de la persona van a la derecha, sin referencias.
 *
 * Recibe: message (el turno a mostrar).
 *
 * Detalle de cada referencia: su tema y confianza, si es propuesta de la IA o aportada por la persona,
 * y para cada fuente: si respalda o contradice, el fragmento citado y el enlace (solo si es seguro).
 */
/** Componente ChatBubble: renderiza la vista de chat. */
function ChatBubble({ message }: { message: VisibleTurn }) {
  // ¿Es una respuesta del asistente? Cambia el estilo y las etiquetas.
  const assistant = message.role === "assistant";
  return (
    // La burbuja. Del asistente: panel a la izquierda. La de la persona: cuadro hundido a la derecha.
    <article className={cn("flex max-w-[92%] flex-col gap-2 rounded-2xl p-4", assistant ? "surface-panel self-start" : "neo-inset self-end")}>
      <header className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="font-semibold text-slate-200">{assistant ? "Asistente" : "Tú"}</span>
      </header>
      {/* El texto del mensaje. "pre-wrap" conserva los saltos de línea que escribió la persona o el asistente. */}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{message.content}</p>
      {/* Las referencias, solo en respuestas del asistente que traigan al menos una. */}
      {assistant && message.references && message.references.length > 0 && (
        <section aria-label="Resultados citados" className="mt-2 flex flex-col gap-3 border-t border-slate-400/15 pt-3">
          <h4 className="text-xs font-semibold text-slate-300">Resultados relacionados</h4>
          <ul className="flex flex-col gap-3">
            {message.references.map((reference) => (
              <li key={reference.id} className="border-l-2 border-kind-evidence/40 pl-3">
                <p className="text-sm text-slate-100">{reference.statement}</p>
                {/* Tema, confianza y de quién viene el resultado. */}
                <p className="mt-1 text-xs text-slate-400">
                  {CATEGORY_LABELS[reference.finding_type]} · {CONFIDENCE_META[reference.confidence_level].label}
                  {reference.origin === "ai" ? " · propuesta de IA" : " · aportado por ti"}
                </p>
                {/* Las fuentes del resultado, o un aviso si no tiene ninguna. */}
                {reference.evidence.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {reference.evidence.map((item, evidenceIndex) => {
                      // Enlace seguro a la fuente, o undefined si no hay dirección o no es segura.
                      const href = item.source_url ? safeHref(item.source_url) : undefined;
                      return (
                        // La clave combina el id del resultado con el número de la fuente.
                        <li key={`${reference.id}-${evidenceIndex}`} className="text-xs text-slate-400">
                          {/* La postura (respalda, contradice o contexto), con su color. */}
                          <span className={STANCE_META[item.stance].className}>
                            {STANCE_META[item.stance].label}:{" "}
                          </span>
                          <blockquote className="mt-1 text-slate-300">«{item.content}»</blockquote>
                          {href ? (
                            // Enlace en pestaña nueva. Si no hay título, usa el dominio.
                            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 hover:text-accent-cyan hover:underline">
                              {item.source_title ?? item.source_domain}
                              <FiExternalLink aria-hidden="true" className="size-3" />
                              <span className="sr-only">(se abre en una pestaña nueva)</span>
                            </a>
                          ) : <span className="mt-1 block">{item.source_domain}</span>}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-amber-200">Este resultado todavía no tiene una fuente externa asociada.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
