/**
 * ARCHIVO: Backdrop.tsx
 *
 * ¿Qué es?
 * Es el "fondo animado" de toda la aplicación: unas bolas de luz de colores que se mueven
 * detrás de todo, como manchas de luz en una pared cuando el sol entra por una ventana.
 * Se dibuja "por debajo" de los botones y las tarjetas para que no estorbe a la lectura.
 *
 * ¿Para qué sirve?
 * - Da una sensación de ambiente y profundidad a la aplicación.
 * - Cada vez que cambias de pantalla (de la página de inicio a un proyecto, por ejemplo),
 *   avisa a la escena 3D cuál es la nueva pantalla, para que cambie su aspecto.
 *
 * ¿Quién lo usa?
 * AppShell.tsx lo coloca en el diseño principal. Es un componente "de fondo": no tiene botones ni texto.
 */

/* Traemos "useEffect": una herramienta de React para hacer algo DESPUÉS de dibujar la pantalla. */
import { useEffect } from "react";
/* Traemos "useLocation" de react-router: nos dice en qué dirección (URL) está la persona, por ejemplo "/proyectos". */
import { useLocation } from "react-router";

/* Traemos del archivo forgeSceneStore: el tipo ForgeMode (lista de pantallas) y la "libreta" forgeSceneStore donde escribimos. */
import { type ForgeMode, forgeSceneStore } from "../../lib/forgeSceneStore";
/* Traemos la función que enciende el efecto de ondas líquidas. */
import { initLiquidGlass } from "../../lib/liquidGlass";

/**
 * routeMode traduce una dirección (por ejemplo "/proyectos/123/hallazgos") en una pantalla
 * de la escena 3D y en un número de paso.
 *
 * Recibe: pathname, que es el texto de la dirección actual (la parte después del dominio).
 * Devuelve: un objeto con dos datos:
 * - mode: el nombre de la pantalla (auth, dashboard, portfolio, composer o workspace).
 * - stageIndex: el número de paso (0 es el primero).
 *
 * Ejemplos sencillos:
 * - "/iniciar-sesion" → { mode: "auth", stageIndex: 0 }
 * - "/proyectos/nuevo" → { mode: "composer", stageIndex: 1 }
 * - "/" → { mode: "dashboard", stageIndex: 0 }
 */
/** Gestiona route mode de interfaz compartida. */
function routeMode(pathname: string): { mode: ForgeMode; stageIndex: number } {
  // Si la dirección es la de entrar o la de registrarse, es la pantalla "auth".
  if (pathname === "/iniciar-sesion" || pathname === "/registro") return { mode: "auth", stageIndex: 0 };
  // Si la dirección es "/proyectos/nuevo" (crear un proyecto), es la pantalla "composer" en el paso 1.
  if (pathname === "/proyectos/nuevo") return { mode: "composer", stageIndex: 1 };
  // Si la dirección empieza con "/proyectos/", significa que estamos DENTRO de un proyecto concreto.
  if (pathname.startsWith("/proyectos/")) {
    // Lista de finales de dirección que representan cada paso dentro del proyecto.
    // El primer elemento es "" (vacío) porque la vista principal del proyecto no tiene final extra.
    const stages = ["", "/investigacion", "/hallazgos", "/competidores", "/analisis", "/asistente", "/fuentes"];
    // "findIndex" busca en la lista el PRIMER final que coincida con la dirección actual.
    // "suffix && pathname.endsWith(suffix)": ignora el "" vacío y revisa si la dirección termina con ese final.
    const found = stages.findIndex((suffix) => suffix && pathname.endsWith(suffix));
    // Devolvemos el modo "workspace" (trabajo dentro de un proyecto).
    // Si no encontramos ningún final (found es -1), usamos el paso 0. Si lo encontramos, usamos ese número.
    return { mode: "workspace", stageIndex: found === -1 ? 0 : found };
  }
  // Si la dirección empieza con "/proyectos" (la lista de todos los proyectos), usamos "portfolio" en el paso 1.
  if (pathname.startsWith("/proyectos")) return { mode: "portfolio", stageIndex: 1 };
  // Cualquier otra dirección (por ejemplo, la página de inicio "/") es la pantalla "dashboard" en el paso 0.
  return { mode: "dashboard", stageIndex: 0 };
}

/**
 * Backdrop dibuja las bolas de luz de fondo y avisa a la escena cuál es la pantalla actual.
 *
 * Cómo se usa: <Backdrop />  (no recibe datos)
 *
 * Qué hace:
 * 1. Enciende el efecto de ondas líquidas una vez.
 * 2. Cada vez que cambia la dirección de la página, traduce la dirección y la escribe en la libreta de la escena.
 * 3. Dibuja las bolas de luz, una capa de "onda" y una rejilla sutil.
 *
 * Nota de estilo: la clase "pointer-events-none" hace que el fondo NO reciba clics (son transparentes al mouse).
 * "fixed inset-0" lo pega a toda la pantalla, sin importar cuánto se desplace la página.
 * "z-0" lo deja en la capa de atrás.
 */
/** Expone la funcion backdrop para el flujo de shared frontend. */
export function Backdrop() {
  // "useLocation" nos da el objeto con la dirección actual. Sacamos de él solo "pathname" (el texto de la dirección).
  const { pathname } = useLocation();

  // Este efecto se ejecuta una sola vez al empezar (la lista vacía [] significa "solo al inicio").
  useEffect(() => {
    // Encendemos el efecto de ondas líquidas en la página.
    initLiquidGlass();
  }, []);

  // Este efecto se ejecuta cada vez que cambia la dirección ("pathname").
  useEffect(() => {
    // Traducimos la dirección a una pantalla y un paso.
    const { mode, stageIndex } = routeMode(pathname);
    // Escribimos esa información en la libreta de la escena 3D. La escena reacciona al nuevo modo.
    forgeSceneStore.set({ mode, stageIndex });
  }, [pathname]);

  // Lo que se dibuja en pantalla: un contenedor transparente que cubre toda la ventana.
  return (
    // "aria-hidden" esconde todo este fondo de los lectores de pantalla (no aporta información escrita).
    // "pointer-events-none": el mouse atraviesa este fondo como si no existiera.
    // "fixed inset-0": ocupa toda la ventana. "z-0": queda al fondo. "overflow-hidden": recorta lo que se salga.
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Gotas y cáusticas de luz de fondo para refracción de cristal líquido */}
      {/* Primera bola de luz: arriba a la izquierda, grande y borrosa (blur-3xl). Su color viene de la variable --orb-primary. */}
      <div
        className="liquid-orb absolute -top-36 -left-20 size-[38rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-primary), transparent 66%)" }}
      />
      {/* Segunda bola de luz: arriba a la derecha. Usa el color --orb-secondary. */}
      <div
        className="liquid-orb liquid-orb--secondary absolute top-6 -right-24 size-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-secondary), transparent 68%)" }}
      />
      {/* Tercera bola de luz: abajo, un poco a la izquierda. Usa el color --orb-tertiary. */}
      <div
        className="liquid-orb liquid-orb--tertiary absolute -bottom-40 left-1/5 size-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-tertiary), transparent 70%)" }}
      />
      {/* Cuarta bola: en el centro de la pantalla, más pequeña, para simular un "brillo" de refracción (--glass-caustic-orb). */}
      <div
        className="liquid-orb liquid-orb--caustic absolute top-1/3 left-1/2 size-[28rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--glass-caustic-orb), transparent 68%)" }}
      />
      {/* Onda ambiental suave al cambiar entre pantallas */}
      {/* "key={pathname}" es un truco de React: cada vez que cambia la dirección, React crea de nuevo esta capa,
          y la animación "liquid-route-wave" vuelve a empezar desde cero. Así se ve una onda al cambiar de pantalla. */}
      <div
        key={pathname}
        className="liquid-route-wave absolute inset-x-0 -top-24 mx-auto h-80 w-[min(64rem,92vw)] rounded-full"
      />
      {/* Retícula sutil */}
      {/* Una rejilla de puntos y líneas muy tenues, como papel cuadriculado de fondo. */}
      <div
        className="absolute inset-0"
        style={{
          // Tres capas de fondo: un patrón de puntos (radial-gradient) y dos rejillas de líneas (linear-gradient) en horizontal y vertical.
          // El color de las líneas viene de la variable --grid-line.
          backgroundImage:
            "radial-gradient(circle, var(--grid-line) 1px, transparent 1px)," +
            "linear-gradient(var(--grid-line) 1px, transparent 1px)," +
            "linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          // Cada cuadro de la rejilla mide 96 píxeles por 96 píxeles.
          backgroundSize: "96px 96px, 96px 96px, 96px 96px",
          // La "máscara" hace que la rejilla se vea fuerte en el centro-superior y se desvanezca hacia los bordes.
          maskImage: "radial-gradient(ellipse at 55% 32%, black 18%, transparent 74%)",
        }}
      />
    </div>
  );
}
