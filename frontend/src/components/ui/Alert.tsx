/**
 * ARCHIVO: Alert.tsx
 *
 * ¿Qué es?
 * Es un "aviso" o "letrero" de color que se pone en una pantalla para decir algo importante.
 * Como un letrero rojo que dice "Cuidado" o uno azul que dice "Ten en cuenta esto".
 *
 * ¿Para qué sirve?
 * Mostrar mensajes de error (algo salió mal) o de información (algo que conviene saber),
 * siempre con el mismo estilo en toda la aplicación.
 *
 * ¿Quién lo usa?
 * Muchas pantallas (ReportsTab.tsx, AdminPage.tsx, formularios...) lo usan cuando hay un problema o una nota.
 */

/* Traemos el tipo "ReactNode": cualquier cosa que React puede dibujar (texto, iconos, otros elementos). */
import type { ReactNode } from "react";
/* Dos iconos: un triángulo de advertencia (para errores) y una "i" de información. */
import { FiAlertTriangle, FiInfo } from "react-icons/fi";

/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";

/**
 * tones es un diccionario con los dos "tonos" del aviso: error (rojo) e información (azul).
 * Cada tono tiene:
 * - className: las clases de color del borde, del fondo y del texto.
 * - Icon: el icono que se muestra a la izquierda.
 *
 * "tones" viene de "tono" (color o carácter del mensaje).
 */
/** Define tones para el bloque de interfaz compartida. */
const tones = {
  // Tono de error: borde rosado suave, fondo rojizo muy tenue, texto rosado claro, y el icono de triángulo.
  error: { className: "border-rose-400/30 bg-rose-500/10 text-rose-100", Icon: FiAlertTriangle },
  // Tono de información: borde celeste suave, fondo azul muy tenue, texto celeste claro, y el icono de "i".
  info: { className: "border-sky-400/30 bg-sky-500/10 text-sky-100", Icon: FiInfo },
};

/**
 * Alert dibuja el aviso en pantalla.
 *
 * Cómo se usa: <Alert>No se pudo guardar.</Alert>  o  <Alert tone="info">Tu informe se está preparando.</Alert>
 *
 * Recibe:
 * - tone (opcional): "error" o "info". Si no se pone, es "error".
 * - children (obligatorio): el texto o contenido que se muestra dentro del aviso.
 *
 * Devuelve: un bloque con icono, borde, fondo y el mensaje.
 */
/** Expone la funcion alert para el flujo de shared frontend. */
export function Alert({ tone = "error", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  // Buscamos en el diccionario "tones" el tono elegido y sacamos sus dos datos: las clases y el icono.
  // Si el tono no existe, esto daría error; por eso el tipo "keyof typeof tones" solo deja pasar "error" o "info".
  const { className, Icon } = tones[tone];
  return (
    // El contenedor del aviso.
    <div
      // Para los lectores de pantalla: los errores se anuncian como "alert" (urgente); la información como "status" (suave).
      role={tone === "error" ? "alert" : "status"}
      // Clases: distribución en fila con el icono arriba a la izquierda ("items-start"), borde, esquinas redondeadas,
      // espacio interior, y el color que vino del tono.
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", className)}
    >
      {/* El icono del tono. "mt-0.5" lo baja un poquito para alinearlo con la primera línea del texto. */}
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" />
      {/* El mensaje que nos pasaron, dentro de un <div> para que pueda tener varias líneas o elementos. */}
      <div>{children}</div>
    </div>
  );
}
