/**
 * ARCHIVO: Spinner.tsx
 *
 * ¿Qué es?
 * Es la "ruedita de carga": un dibujo pequeño que gira para avisar "espera, estoy trabajando".
 * En este proyecto no es un círculo común: es un hexágono (figura de seis lados) con un punto en el centro,
 * porque la marca de IdeaForge es una forja con esa forma.
 *
 * ¿Para qué sirve?
 * Para mostrar que algo se está cargando o procesando (por ejemplo, al generar un informe),
 * sin dejar a la persona preguntándose si la app se trabó.
 *
 * ¿Quién lo usa?
 * Button.tsx lo muestra dentro del botón cuando está en modo "loading", y otras pantallas lo usan para indicar carga.
 */

/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";

/**
 * Spinner dibuja el indicador de carga giratorio.
 *
 * Cómo se usa: <Spinner />   o   <Spinner className="size-6 text-amber-300" />
 *
 * Recibe: className (opcional): clases extra para cambiar tamaño o color.
 * Devuelve: un dibujo SVG (imagen vectorial) que gira sin parar.
 */
/** Pulso geométrico de la forja (reemplaza el spinner circular genérico). */
export function Spinner({ className }: { className?: string }) {
  // Dibujamos el SVG: una imagen hecha de figuras (líneas, polígonos y círculos) en lugar de un archivo de foto.
  return (
    <svg
      // "viewBox" define el "área de dibujo" en unidades invisibles de 24 x 24. El dibujo se escala a cualquier tamaño.
      viewBox="0 0 24 24"
      // "fill none" quiere decir: por defecto no rellenar las figuras, solo dibujar sus bordes.
      fill="none"
      // Escondemos el dibujo de los lectores de pantalla: es solo decorativo.
      aria-hidden="true"
      // "size-4": tamaño de 16 px. "shrink-0": que no se encoja. "animate-spin": que gire sin parar (animación de Tailwind).
      // "cn" agrega las clases extra que lleguen desde afuera.
      className={cn("size-4 shrink-0 animate-spin", className)}
    >
      {/* El hexágono de fondo, con los seis vértices (esquinas) escritos como pares de coordenadas x,y. */}
      {/* "strokeOpacity 0.28" lo hace bastante transparente, para que sea una guía suave. */}
      <polygon
        points="12,2.5 20.5,7.5 20.5,16.5 12,21.5 3.5,16.5 3.5,7.5"
        // "stroke=currentColor" usa el mismo color que el texto a su alrededor.
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="2"
      />
      {/* Una línea más marcada que recorre tres lados del hexágono, dando la sensación de movimiento de la forja. */}
      {/* "strokeLinecap round" hace que los extremos de la línea sean redondeados. */}
      <path
        d="M12 2.5 20.5 7.5v9L12 21.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* El punto central, relleno del mismo color, como el núcleo de la forja. */}
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}
