import { type FormEvent, useState } from "react";
import { FiExternalLink, FiMessageCircle, FiTrash2, FiZap } from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { TextArea } from "../../components/ui/TextArea";
import { cn } from "../../lib/cn";
import { errorMessageFrom } from "../../lib/formErrors";
import { CONFIDENCE_META, STANCE_META } from "../findings/constants";
import { useProjectOutlet } from "../projects/outlet";
import { CATEGORY_LABELS, safeHref } from "../research/constants";
import { chatApi } from "./api";
import type { ChatFindingReference, ChatTurn } from "./types";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_CHARS = 5000;

const QUICK_PROMPTS = [
  "¿Qué sabemos de los posibles clientes?",
  "¿Qué problemas o riesgos debería considerar?",
  "¿Qué debería probar primero?",
  "¿Qué dudas siguen abiertas?",
];

interface VisibleTurn extends ChatTurn {
  references?: ChatFindingReference[];
}

export function ChatTab() {
  const { project } = useProjectOutlet();
  const [messages, setMessages] = useState<VisibleTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = question.trim();
    if (!message || pending) return;

    const history = trimHistory(messages.slice(-12), message);
    setError(null);
    setPending(true);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    try {
      const reply = await chatApi.sendMessage(project.id, { message, history });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: reply.answer,
          references: reply.references,
        },
      ]);
    } catch (cause) {
      setMessages((current) => current.slice(0, -1));
      setQuestion(message);
      setError(cause);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Pregunta sobre tu idea</h2>
        <p className="max-w-3xl text-sm text-slate-400">
          Pregunta lo que quieras. Puedo usar la información y las fuentes guardadas en este proyecto, pero no hago búsquedas nuevas en internet.
        </p>
      </header>

      <GlassPanel className="stage-3d flex min-h-[26rem] flex-col gap-4 rounded-3xl p-4 sm:p-6">
        <div
          role="log"
          aria-label="Conversación del proyecto"
          aria-live="polite"
          className="flex max-h-[60vh] min-h-72 flex-col gap-4 overflow-y-auto pr-1"
        >
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
            messages.map((message, index) => (
              <ChatBubble key={`${index}-${message.role}`} message={message} />
            ))
          )}
          {pending && (
            <p role="status" className="flex items-center gap-2 text-sm text-accent-cyan">
              <span className="size-2 animate-pulse rounded-full bg-current" /> Revisando la información del proyecto…
            </p>
          )}
        </div>

        {error != null && <Alert>{errorMessageFrom(error)}</Alert>}

        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-slate-400/15 pt-4">
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
            <Button type="submit" size="sm" loading={pending} disabled={!question.trim()}>
              Enviar
            </Button>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}

function trimHistory(messages: ChatTurn[], message: string): ChatTurn[] {
  const history = messages.map(({ role, content }) => ({ role, content }));
  let total = message.length + history.reduce((sum, turn) => sum + turn.content.length, 0);
  while (history.length > 0 && (history.length > 14 || total > MAX_HISTORY_CHARS)) {
    const dropPair = history[0]?.role === "user" && history[1]?.role === "assistant";
    const removed = history.splice(0, dropPair ? 2 : 1);
    total -= removed.reduce((sum, turn) => sum + turn.content.length, 0);
  }
  return history;
}

function ChatBubble({ message }: { message: VisibleTurn }) {
  const assistant = message.role === "assistant";
  return (
    <article className={cn("flex max-w-[92%] flex-col gap-2 rounded-2xl p-4", assistant ? "surface-panel self-start" : "neo-inset self-end")}>
      <header className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="font-semibold text-slate-200">{assistant ? "Asistente" : "Tú"}</span>
      </header>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{message.content}</p>
      {assistant && message.references && message.references.length > 0 && (
        <section aria-label="Resultados citados" className="mt-2 flex flex-col gap-3 border-t border-slate-400/15 pt-3">
          <h4 className="text-xs font-semibold text-slate-300">Resultados relacionados</h4>
          <ul className="flex flex-col gap-3">
            {message.references.map((reference) => (
              <li key={reference.id} className="border-l-2 border-kind-evidence/40 pl-3">
                <p className="text-sm text-slate-100">{reference.statement}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {CATEGORY_LABELS[reference.finding_type]} · {CONFIDENCE_META[reference.confidence_level].label}
                  {reference.origin === "ai" ? " · propuesta de IA" : " · aportado por ti"}
                </p>
                {reference.evidence.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {reference.evidence.map((item, evidenceIndex) => {
                      const href = item.source_url ? safeHref(item.source_url) : undefined;
                      return (
                        <li key={`${reference.id}-${evidenceIndex}`} className="text-xs text-slate-400">
                          <span className={STANCE_META[item.stance].className}>
                            {STANCE_META[item.stance].label}:{" "}
                          </span>
                          <blockquote className="mt-1 text-slate-300">«{item.content}»</blockquote>
                          {href ? (
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
