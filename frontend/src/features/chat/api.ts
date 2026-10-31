/**
 * ARCHIVO: chat/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" del chat: sabe qué dirección del servidor usar para enviar una pregunta al asistente.
 *
 * ¿Para qué sirve?
 * ChatTab no escribe la dirección a mano. Si el servidor cambia la ruta del chat, solo se toca aquí.
 *
 * ¿Quién lo usa?
 * ChatTab.tsx (en su función submit).
 *
 * Esta función es una petición POST: manda la pregunta y el historial, y recibe la respuesta.
 * La convierte en formato JSON y los errores los maneja apiRequest (lib/apiClient.ts).
 */

/* Función central que habla con el backend y agrega la sesión. */
import { apiRequest } from "../../lib/apiClient";
/* Forma de lo que se envía (ChatRequest) y de lo que se recibe (ChatReply). */
import type { ChatReply, ChatRequest } from "./types";

/**
 * chatApi agrupa las peticiones del chat. Por ahora solo tiene una: enviar un mensaje.
 */
/** Define chat api como dato o funcion publica de chat. */
export const chatApi = {
  // Envía la pregunta y el historial a /projects/{id}/chat (POST) y devuelve la respuesta del asistente.
  sendMessage: (projectId: string, data: ChatRequest) =>
    apiRequest<ChatReply>(`/projects/${projectId}/chat`, { method: "POST", body: data }),
};
