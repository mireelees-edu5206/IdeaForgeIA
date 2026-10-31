/**
 * ARCHIVO: AppShell.tsx
 *
 * ¿Qué es?
 * Es la "carcasa" o marco de todas las pantallas privadas (las que se ven después de entrar).
 * Piensa en un cuadro: el marco se queda igual siempre, y dentro se cambia la foto según la pantalla.
 *
 * ¿Para qué sirve?
 * Dibuja siempre lo mismo alrededor de cada pantalla:
 * - el fondo animado (Backdrop),
 * - el menú lateral en computadoras (Sidebar),
 * - la barra superior (Topbar),
 * - y en el centro, la pantalla que corresponde a la dirección actual (el "Outlet").
 * También ayuda a las personas que usan teclado o lector de pantalla con un enlace "Saltar al contenido".
 *
 * ¿Quién lo usa?
 * El archivo de rutas (app/router.tsx) lo pone como "padre" de las pantallas privadas.
 * Cuando cambias de página, React Router pone la nueva pantalla dentro del "Outlet" de este marco.
 */

/* Traemos "useEffect" (hacer algo después de dibujar), "useRef" (una "etiqueta" para encontrar un elemento real de la página). */
import { useEffect, useRef } from "react";
/* "Outlet" es el hueco del marco donde se mete la pantalla actual. "useLocation" nos dice la dirección actual. */
import { Outlet, useLocation } from "react-router";

/* El fondo animado que va detrás de todo. */
import { Backdrop } from "./Backdrop";
/* El menú lateral (solo en computadoras grandes). */
import { Sidebar } from "./Sidebar";
/* La barra superior (y la barra inferior en celulares). */
import { Topbar } from "./Topbar";

/**
 * resolveScreenKey decide un "nombre de identificación" para la pantalla actual.
 * Lo usamos como "llave" (key) para que React sepa cuándo cambió de pantalla y repita la animación.
 *
 * Regla simple: si estás dentro de un proyecto concreto (por ejemplo "/proyectos/abc123/hallazgos"),
 * la llave es solo "/proyectos/abc123". Así, cambiar entre pestañas del mismo proyecto NO repite la animación,
 * pero entrar a otro proyecto sí.
 *
 * Recibe: pathname, la dirección actual (por ejemplo "/proyectos/abc123/hallazgos").
 * Devuelve: el texto de la llave (por ejemplo "/proyectos/abc123"), o la misma dirección si no aplica.
 */
/** Gestiona resolve screen key de interfaz compartida. */
function resolveScreenKey(pathname: string): string {
  // Una "expresión regular" es una plantilla de búsqueda de texto. Esta busca "/proyectos/" seguido de un identificador.
  // La parte ([^/]+) significa "uno o más caracteres que NO sean barra /": así atrapamos el identificador del proyecto.
  const projectRoute = /^\/proyectos\/([^/]+)/.exec(pathname);
  // Si la búsqueda encontró algo, y el identificador NO es la palabra "nuevo" (la página de crear proyecto)...
  if (projectRoute && projectRoute[1] !== "nuevo") {
    // ...devolvemos solo la parte "/proyectos/identificador", sin las pestañas de abajo.
    return `/proyectos/${projectRoute[1]}`;
  }
  // En cualquier otro caso, la llave es la dirección completa.
  return pathname;
}

/**
 * AppShell dibuja el marco completo de la aplicación.
 *
 * Cómo se usa: lo llama el router; no se pone a mano en otras pantallas.
 * Recibe: nada (toma la dirección actual del navegador).
 * Devuelve: el marco con el fondo, el menú, la barra superior y la pantalla actual dentro.
 */
/** Expone la funcion app shell para el flujo de shared frontend. */
export function AppShell() {
  // Leemos la dirección actual y la guardamos en "pathname".
  const { pathname } = useLocation();
  // Calculamos la llave de la pantalla usando la función de arriba.
  const screenKey = resolveScreenKey(pathname);
  // "mainRef" es como una etiqueta que pegamos a la etiqueta <main> para poder tocarla desde el código.
  // Empieza vacía (null) y React la llena cuando dibuja la pantalla.
  const mainRef = useRef<HTMLElement>(null);

  // Cada vez que cambia la dirección ("pathname"), movemos el foco del teclado al contenido principal.
  // El foco es "dónde está el cursor de teclado". Así, quien usa el teclado no tiene que volver a empezar desde arriba.
  // "preventScroll: true" evita que la página salte de golpe hacia arriba o abajo.
  useEffect(() => {
    // El "?." significa: si la etiqueta existe, enfoca; si todavía no existe, no hagas nada.
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    // El contenedor más grande. Sus clases de Tailwind hacen esto:
    // - "relative": permite poner elementos encima de él con posiciones absolutas.
    // - "min-h-dvh": ocupa al menos toda la altura de la pantalla visible.
    // - "px-3 sm:px-5 lg:px-6": espacio a los lados, que crece en pantallas más grandes.
    // - "pt-[calc(0.75rem+env(safe-area-inset-top))]": espacio arriba, respetando la muesca de algunos celulares.
    // - "pb-[calc(5.75rem+env(safe-area-inset-bottom))]": espacio abajo, para no tapar la barra inferior del celular.
    // - "lg:py-4": espacio arriba y abajo en pantallas grandes.
    <div className="relative min-h-dvh px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-6 lg:py-4">
      {/* El fondo animado, detrás de todo lo demás. */}
      <Backdrop />
      {/* Enlace invisible para personas que usan teclado: al presionar Tab aparece y lleva directo al contenido. */}
      {/* "sr-only" lo esconde (solo lo leen los lectores de pantalla); "focus:not-sr-only" lo muestra cuando recibe el foco. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      {/* Esta cuadrícula divide la pantalla en dos columnas en computadoras: menú a la izquierda y contenido a la derecha. */}
      {/* En celulares es una sola columna ("grid-cols-1"). "z-10" pone el contenido encima del fondo animado. */}
      <div className="relative z-10 mx-auto grid w-full max-w-[1680px] grid-cols-1 gap-0 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-6">
        {/* El menú lateral (solo se ve en pantallas grandes, lo controla Sidebar.tsx). */}
        <Sidebar />
        {/* La columna del contenido. "min-w-0" evita que algo muy ancho empuje y rompa el diseño. */}
        <div className="min-w-0">
          {/* La barra superior con el nombre de la página y los botones. */}
          <Topbar />
          {/* El contenido principal. "ref={mainRef}" conecta la etiqueta de arriba. "id=contenido" es el destino del enlace "Saltar al contenido". */}
          {/* "tabIndex={-1}" permite que el código le pase el foco, aunque no entre en el orden normal de Tab. */}
          <main ref={mainRef} id="contenido" tabIndex={-1} className="mt-5 w-full scroll-mt-24">
            {/* Este <div> tiene la llave de la pantalla. Cuando la llave cambia, React lo vuelve a crear y la animación "animate-liquid-screen" se ve de nuevo. */}
            <div key={screenKey} className="animate-liquid-screen">
              {/* "Outlet" es el hueco donde se dibuja la pantalla que corresponde a la dirección actual (por ejemplo, el panel o un proyecto). */}
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
