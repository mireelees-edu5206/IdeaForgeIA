/**
 * ARCHIVO: ConfirmDialog.tsx
 *
 * ¿Qué es?
 * Es una ventanita de "¿estás seguro?" que aparece encima de la pantalla antes de hacer algo
 * que no se puede deshacer, como borrar un proyecto o una cuenta. Es como el aviso de
 * "¿seguro que quieres tirar esto?" antes de que alguien tire una hoja importante.
 *
 * ¿Para qué sirve?
 * Evita borrados por accidente. La persona debe pulsar el botón rojo para confirmar, o
 * "Cancelar" para salir. Mientras la acción se procesa, el botón muestra la ruedita de carga.
 *
 * ¿Quién lo usa?
 * Las pantallas que borran datos: la lista de proyectos, el detalle de un proyecto y la
 * administración de cuentas. Cada una controla si la ventana está abierta con la prop "open".
 *
 * Detalles técnicos explicados en lenguaje sencillo:
 * - Usa la etiqueta nativa <dialog> del navegador. Ventaja: el navegador ya sabe atrapar el
 *   foco del teclado dentro de la ventana y oscurecer el fondo.
 * - Si el navegador es muy viejo y no sabe usar <dialog>, se usa un plan B con un atributo "open".
 */

/* "type ReactNode" es cualquier contenido que React puede dibujar (texto, iconos, otros elementos).
   "useEffect" hace algo después de dibujar. "useId" crea un identificador único. "useRef" guarda una
   referencia directa a un elemento real de la página (aquí, la ventana <dialog>). */
import { type ReactNode, useEffect, useId, useRef } from "react";

/* Traemos el botón estándar de la app para los dos botones de la ventana. */
import { Button } from "./Button";

/**
 * ConfirmDialogProps describe qué datos recibe la ventana:
 * - open: si la ventana está abierta (true) o cerrada (false).
 * - title: el título de arriba (por ejemplo "Borrar proyecto").
 * - children: el texto explicativo que aparece debajo del título.
 * - confirmLabel: el texto del botón rojo (por ejemplo "Sí, borrar").
 * - loading (opcional): si es true, el botón de confirmar muestra la carga y no se puede tocar.
 * - onConfirm: la función que se ejecuta cuando la persona confirma.
 * - onCancel: la función que se ejecuta cuando cancela (botón, tecla Escape o cerrar).
 */
/** Contrato de datos ConfirmDialogProps utilizado por interfaz compartida. */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog dibuja la ventana de confirmación y la abre o cierra según "open".
 *
 * Cómo se usa (ejemplo):
 * <ConfirmDialog open={pidiendoBorrar} title="Borrar proyecto" confirmLabel="Sí, borrar"
 *   onConfirm={borrar} onCancel={() => setPidiendoBorrar(false)}>
 *   Esta acción no se puede deshacer.
 * </ConfirmDialog>
 */
/** Diálogo modal nativo (<dialog>): foco atrapado y cierre con Escape de serie. */
export function ConfirmDialog({ open, title, children, confirmLabel, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  // "ref" es la conexión directa con la etiqueta <dialog> de abajo. Así podemos llamar a showModal() o close().
  const ref = useRef<HTMLDialogElement>(null);
  // "titleId" es un nombre único para el título. La ventana lo usa para decir "mi nombre es este título".
  const titleId = useId();

  // Este bloque se ejecuta cada vez que cambia "open": abre o cierra la ventana de verdad.
  useEffect(() => {
    const dialog = ref.current;
    // Si todavía no existe la ventana en la página, no hay nada que hacer.
    if (!dialog) return;
    // Caso 1: hay que abrirla y todavía no está abierta.
    if (open && !dialog.open) {
      // "showModal" abre la ventana como modal: bloquea el resto de la pantalla y pone el foco dentro.
      if (typeof dialog.showModal === "function") dialog.showModal();
      // Plan B para navegadores viejos: solo le ponemos el atributo "open" para que se vea.
      else dialog.setAttribute("open", "");
      // Caso 2: hay que cerrarla y todavía está abierta.
    } else if (!open && dialog.open) {
      // "close" la cierra y devuelve el control a la pantalla de atrás.
      if (typeof dialog.close === "function") dialog.close();
      // Plan B: quitamos el atributo "open".
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Le decimos a la ventana cuál es su título, para lectores de pantalla.
      aria-labelledby={titleId}
      // Esto se ejecuta cuando la persona presiona la tecla Escape (que el navegador intenta usar para cerrar).
      onCancel={(event) => {
        // Evitamos que el navegador la cierre solo, porque nosotros queremos decidir.
        event.preventDefault();
        // Si la acción está en proceso ("loading"), no dejamos cancelar a la mitad.
        if (!loading) onCancel();
      }}
      // Estilo: "glass" es el cristal, "m-auto" la centra, el ancho máximo es 28 rem o la pantalla menos 2 rem.
      // "backdrop:..." pinta el fondo oscuro detrás de la ventana, con un desenfoque suave.
      className="glass m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-6 text-slate-100 backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm"
    >
      {/* El título de la ventana. Su id es el mismo que pusimos en aria-labelledby. */}
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      {/* El texto explicativo. "text-slate-300" es un gris claro para que se lea sin competir con el título. */}
      <div className="mt-2 text-sm text-slate-300">{children}</div>
      {/* Los botones. En celular van uno sobre otro (con "flex-col-reverse" el de confirmar queda arriba);
          en pantallas grandes van en fila, alineados a la derecha. */}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {/* Botón "Cancelar": tiene el foco al abrir (autoFocus) para que, si la persona presiona Enter sin pensar, no borre nada. */}
        <Button variant="ghost" onClick={onCancel} disabled={loading} autoFocus>
          Cancelar
        </Button>
        {/* Botón de confirmar: rojo ("danger") porque la acción es destructiva. Muestra la ruedita si "loading" es true. */}
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
