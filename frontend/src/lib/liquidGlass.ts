/**
 * ARCHIVO: liquidGlass.ts
 *
 * ¿Qué es?
 * Es el efecto de "agua" al tocar un botón. Cuando haces clic, aparecen ondas que se expanden
 * desde el punto exacto donde tocaste, como cuando tiras una piedrita a un charco.
 *
 * ¿Para qué sirve?
 * Hace que los botones se sientan vivos y líquidos. El efecto se dibuja con elementos HTML
 * pequeños y animaciones CSS (definidas en index.css), no con un juego de gráficos pesado.
 *
 * ¿Quién lo usa?
 * - components/ui/Button.tsx lo activa al cargarse.
 * - components/layout/Backdrop.tsx también llama a initLiquidGlass().
 *
 * Accesibilidad: si la persona pidió "reducir movimiento" en su sistema, no se dibuja ninguna onda.
 */

/**
 * WAVE_TARGET_SELECTOR es una "búsqueda": la lista de tipos de elementos que SÍ deben mostrar ondas.
 * Piensa en ella como una lista de invitados: "botones que no estén apagados", "enlaces con clase jelly",
 * y "elementos con rol de botón que no digan aria-disabled=true".
 * La palabra "selector" viene de CSS: es la forma de decir "busca estos elementos".
 */
const WAVE_TARGET_SELECTOR =
  'button:not(:disabled), a.jelly, [role="button"]:not([aria-disabled="true"])';

/**
 * MAX_ACTIVE_RIPPLES es el límite de ondas que puede haber al mismo tiempo dentro de un botón.
 * Si ya hay 2, quitamos la más vieja antes de crear otra. Así no se llena de ondas y se mantiene fluido.
 */
/** Define MAX_ACTIVE_RIPPLES para el bloque de servicios compartidos. */
const MAX_ACTIVE_RIPPLES = 2;

/**
 * initialized es un "interruptor de encendido": false = todavía no se encendió el efecto.
 * Se pone en true la primera vez, para no volver a agregar los mismos escuchadores.
 */
/** Define initialized para el bloque de servicios compartidos. */
let initialized = false;

/**
 * lastPointerDownAt guarda la hora (en milisegundos) del último toque o clic del mouse.
 * Sirve para evitar que la misma acción cree ondas dos veces (una al presionar y otra al soltar).
 */
/** Define lastPointerDownAt para el bloque de servicios compartidos. */
let lastPointerDownAt = 0;

/**
 * prefersReducedMotion pregunta: "¿La persona pidió reducir el movimiento en su computadora o celular?"
 * Algunas personas se marean con animaciones; por eso el sistema tiene esta opción.
 *
 * Recibe: nada.
 * Devuelve: true si pidió reducir movimiento; false si no (o si no podemos saberlo).
 */
/** Gestiona prefers reduced motion de servicios compartidos. */
function prefersReducedMotion(): boolean {
  return (
    // ¿Existe "window"? "window" es la ventana del navegador. Si no existe, estamos en un entorno sin página.
    typeof window !== "undefined" &&
    // ¿El navegador sabe hacer la consulta "matchMedia"? Algunos navegadores viejos no la tienen.
    typeof window.matchMedia === "function" &&
    // Hacemos la consulta: "¿el usuario prefiere reducir movimiento?" y miramos si la respuesta es sí.
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * spawnLiquidWaves crea las ondas dentro de un elemento (por ejemplo, un botón).
 *
 * Recibe:
 * - element: el botón o elemento donde se dibujarán las ondas.
 * - clientX y clientY (opcionales): la posición exacta del clic en la pantalla.
 *   Si no llegan, las ondas salen desde el centro del elemento.
 * Devuelve: nada. Dibuja ondas y las borra solas después de un momento.
 */
/** Expone la funcion spawn liquid waves para el flujo de shared frontend. */
export function spawnLiquidWaves(
  element: HTMLElement,
  clientX?: number,
  clientY?: number,
): void {
  // Si la persona pidió menos movimiento, salimos sin hacer nada.
  if (prefersReducedMotion()) return;

  // Buscamos las ondas que ya existen dentro de este elemento. "querySelectorAll" devuelve una lista.
  const existing = element.querySelectorAll(".liquid-ripple");
  // Si ya hay demasiadas (el máximo), borramos la primera de la lista (la más vieja).
  // El "?." en existing[0]?. significa: si existe, bórrala; si no existe, no hagas nada.
  if (existing.length >= MAX_ACTIVE_RIPPLES) {
    existing[0]?.remove();
  }

  // "getBoundingClientRect" nos da el rectángulo del elemento: dónde está y qué tamaño tiene.
  const rect = element.getBoundingClientRect();
  // Usamos el ancho del rectángulo. Si da 0 (algo raro), probamos el ancho del elemento. Si tampoco sirve, usamos 120.
  // El "||" significa "o": toma el primero que sea útil.
  const width = rect.width || element.offsetWidth || 120;
  // Lo mismo para el alto: si no se puede medir, usamos 44.
  const height = rect.height || element.offsetHeight || 44;

  // ¿Tenemos coordenadas válidas del clic? Revisamos varias cosas a la vez:
  // - que clientX sea un número,
  // - que clientY sea un número,
  // - que no sean ambas 0 (un clic exacto en la esquina de la pantalla no es confiable),
  // - y que el elemento tenga tamaño real.
  const hasCoords =
    typeof clientX === "number" &&
    typeof clientY === "number" &&
    (clientX !== 0 || clientY !== 0) &&
    rect.width > 0 &&
    rect.height > 0;

  // Calculamos el punto de inicio de la onda dentro del elemento.
  // Si tenemos coordenadas, restamos la posición del elemento para saber dónde tocaste DENTRO del botón.
  // Si no, empezamos en el centro (la mitad del ancho y la mitad del alto).
  const x = hasCoords ? clientX - rect.left : width / 2;
  const y = hasCoords ? clientY - rect.top : height / 2;
  // Calculamos qué tan lejos está la esquina más lejana desde el punto de inicio (como medir la diagonal).
  // "Math.hypot" calcula la distancia de la hipotenusa, es decir, la línea más corta entre dos puntos en diagonal.
  const maxRadius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  // Calculamos el tamaño final de la onda: debe ser lo bastante grande para cubrir el botón entero.
  // "Math.max" toma el número más grande de la lista; "Math.round" lo redondea a un número entero.
  const size = Math.round(Math.max(maxRadius * 2.2, Math.max(width, height) * 1.8, 92));

  // Marcamos el elemento con dos clases: "liquid-host" (contenedor de ondas) e "is-liquid-waving" (está ondeando ahora).
  element.classList.add("liquid-host", "is-liquid-waving");

  // Creamos el elemento principal de la onda: un <span> vacío.
  const ripple = document.createElement("span");
  // Le ponemos la clase que define cómo se ve la onda (en index.css).
  ripple.className = "liquid-ripple";
  // Lo escondemos de los lectores de pantalla: la onda es solo decorativa.
  ripple.setAttribute("aria-hidden", "true");
  // Una marca extra útil para encontrarla o probarla.
  ripple.setAttribute("data-liquid-wave", "true");
  // Le damos el tamaño calculado (en píxeles) en ancho y alto.
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  // Y la colocamos en el punto donde tocamos. "Math.round" evita decimales.
  ripple.style.left = `${Math.round(x)}px`;
  ripple.style.top = `${Math.round(y)}px`;

  // La "gota" del centro: el pequeño punto que aparece justo en el clic.
  const drop = document.createElement("span");
  drop.className = "liquid-ripple__drop";

  // Las tres olas concéntricas (una dentro de otra, como anillos en el agua).
  // Cada una tiene su propia clase con un número (1, 2 o 3) para que se expandan en tiempos distintos.
  const wave1 = document.createElement("span");
  wave1.className = "liquid-ripple__wave liquid-ripple__wave--1";

  const wave2 = document.createElement("span");
  wave2.className = "liquid-ripple__wave liquid-ripple__wave--2";

  const wave3 = document.createElement("span");
  wave3.className = "liquid-ripple__wave liquid-ripple__wave--3";

  // Metemos la gota y las tres olas dentro de la onda principal.
  ripple.append(drop, wave1, wave2, wave3);
  // Y la onda completa la metemos dentro del elemento (el botón). Ahora se ve en pantalla.
  element.appendChild(ripple);

  // "cleanup" es la función que limpia todo cuando la animación termina: borra la onda
  // y quita la marca "is-liquid-waving" si ya no quedan más ondas.
  const cleanup = () => {
    // Borramos la onda de la pantalla.
    ripple.remove();
    // Si ya no queda ninguna onda dentro del elemento, quitamos la marca de "ondeando".
    if (!element.querySelector(".liquid-ripple")) {
      element.classList.remove("is-liquid-waving");
    }
  };

  // Le pedimos que ejecute "cleanup" cuando la última ola (la 3) termine su animación.
  // "once: true" significa "solo una vez" y se borra el escuchador solo.
  wave3.addEventListener("animationend", cleanup, { once: true });
  // Como plan B, también ejecutamos "cleanup" después de 1 segundo, por si la animación nunca avisa que terminó.
  const timer = setTimeout(cleanup, 1000);
  // Esta línea le dice al programa: "no esperes a este temporizador para cerrar la app". Es un detalle técnico de seguridad.
  (timer as unknown as { unref?: () => void }).unref?.();
}

/**
 * handlePointerDown se ejecuta cada vez que presionas el mouse o tocas la pantalla.
 * Decide si ese toque fue sobre un botón y, si lo fue, crea las ondas.
 *
 * Recibe: event (la información del toque: dónde fue, con qué botón del mouse, etc.).
 * Devuelve: nada.
 */
/** Gestiona handle pointer down de servicios compartidos. */
function handlePointerDown(event: PointerEvent): void {
  // "event.button" dice qué botón del mouse se presionó. 0 = botón izquierdo (el principal). Si no es ese, salimos.
  if (event.button !== 0) return;
  // "event.target" es el elemento exacto que tocaste. Revisamos que sea un elemento de la página, no algo raro.
  // Si lo es, lo guardamos; si no, guardamos null (nada).
  const target = event.target instanceof Element ? event.target : null;
  // Si no hay elemento, no podemos hacer nada, así que salimos.
  if (!target) return;
  // "closest" busca hacia arriba (padre por padre) el primer elemento que coincida con WAVE_TARGET_SELECTOR.
  // Así, si tocas el texto dentro de un botón, igual encontramos el botón.
  const interactive = target.closest<HTMLElement>(WAVE_TARGET_SELECTOR);
  // Si no encontramos un botón o similar, no hay ondas que dibujar.
  if (!interactive) return;
  // Guardamos la hora de este toque (en milisegundos desde 1970). "Date.now()" devuelve esa hora.
  lastPointerDownAt = Date.now();
  // Dibujamos las ondas en el botón, desde la posición del toque.
  spawnLiquidWaves(interactive, event.clientX, event.clientY);
}

/**
 * handleClick se ejecuta cuando se completa un clic (cuando se suelta el botón del mouse).
 * Sirve para cubrir clics que no pasaron por handlePointerDown (por ejemplo, con teclado).
 *
 * Recibe: event (la información del clic).
 * Devuelve: nada.
 */
/** Gestiona handle click de servicios compartidos. */
function handleClick(event: MouseEvent): void {
  // Si el último toque fue hace menos de 420 milisegundos, ya creamos ondas en ese toque.
  // Salimos para no duplicarlas. (420 milisegundos es menos de medio segundo.)
  if (Date.now() - lastPointerDownAt < 420) return;
  // Igual que antes: buscamos el elemento que se tocó.
  const target = event.target instanceof Element ? event.target : null;
  // Si no hay elemento, salimos.
  if (!target) return;
  // Buscamos hacia arriba el botón o elemento interactivo más cercano.
  const interactive = target.closest<HTMLElement>(WAVE_TARGET_SELECTOR);
  // Si no hay botón, salimos.
  if (!interactive) return;
  // Creamos las ondas desde la posición del clic.
  spawnLiquidWaves(interactive, event.clientX, event.clientY);
}

/**
 * initLiquidGlass prende el efecto en toda la página: empieza a escuchar los toques y clics.
 *
 * Recibe: nada.
 * Devuelve: nada. Es seguro llamarla varias veces: solo se activa la primera vez.
 */
/** Expone la funcion init liquid glass para el flujo de shared frontend. */
export function initLiquidGlass(): void {
  // Si ya se encendió antes, o si estamos en un entorno sin página, no hacemos nada.
  if (initialized || typeof window === "undefined") return;
  // Ponemos el interruptor en "encendido" para que no se repita.
  initialized = true;
  // Empezamos a escuchar los toques en TODA la ventana. "passive: true" le dice al navegador
  // que no vamos a cancelar el toque, así puede seguir fluido.
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  // Y también escuchamos los clics en toda la ventana.
  window.addEventListener("click", handleClick, { passive: true });
}
