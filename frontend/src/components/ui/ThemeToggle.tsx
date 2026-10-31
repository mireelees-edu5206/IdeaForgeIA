/**
 * ARCHIVO: ThemeToggle.tsx
 *
 * ¿Qué es?
 * Es el interruptor de "modo claro / modo oscuro", como el interruptor de la luz de un cuarto.
 * Tiene un icono de luna (para pasar a oscuro) o de sol (para pasar a claro).
 *
 * ¿Para qué sirve?
 * Permite cambiar los colores de toda la aplicación y recuerda la elección de la persona.
 * La elección se guarda en el "localStorage" del navegador, que es como una cajita pequeña
 * donde el navegador guarda datos aunque cierres la página.
 *
 * ¿Quién lo usa?
 * - SettingsPage.tsx y la barra superior lo muestran al usuario.
 * - index.html y main.tsx usan la misma clave "ideaforge-theme" para aplicar el tema desde el inicio.
 */

/* Traemos dos herramientas de React: "useEffect" (hacer algo después de dibujar) y "useState" (guardar un valor que puede cambiar). */
import { useEffect, useState } from "react";
/* Traemos dos dibujitos de iconos: una luna (FiMoon) y un sol (FiSun). */
import { FiMoon, FiSun } from "react-icons/fi";

/**
 * ThemeMode es una lista cerrada de dos palabras: "light" (claro) o "dark" (oscuro).
 * Solo se permite una de esas dos.
 */
/** Describe el contrato theme mode utilizado por shared frontend. */
export type ThemeMode = "light" | "dark";

/**
 * STORAGE_KEY es el nombre del cajón donde guardamos la elección del tema en el navegador.
 * Usamos siempre el mismo nombre para encontrar el mismo cajón.
 */
/** Catalogo STORAGE_KEY que define etiquetas o reglas de interfaz compartida. */
const STORAGE_KEY = "ideaforge-theme";

/**
 * THEME_COLORS es un diccionario con el color de la barra del celular para cada tema.
 * Por ejemplo, en modo oscuro la barra del navegador en el celular se pinta azul muy oscuro.
 */
/** Configuracion visual de THEME_COLORS para ubicar colores/animaciones de interfaz compartida. */
const THEME_COLORS: Record<ThemeMode, string> = {
  // Modo claro: gris muy clarito (#f8fafc).
  light: "#f8fafc",
  // Modo oscuro: azul casi negro (#0b1220).
  dark: "#0b1220",
};

/**
 * readInitialTheme lee del cajón (localStorage) qué tema eligió la persona la última vez.
 *
 * Recibe: nada.
 * Devuelve: "dark" si guardó el oscuro; "light" en cualquier otro caso (incluido "no hay nada guardado").
 */
/** Expone la funcion read initial theme para el flujo de shared frontend. */
export function readInitialTheme(): ThemeMode {
  // Intentamos abrir el cajón. Puede fallar en navegadores que no dejan guardar datos (modo privado).
  try {
    // Pedimos el valor guardado con la clave "ideaforge-theme".
    // Si el valor es exactamente "dark", devolvemos "dark"; si no, devolvemos "light".
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    // Si no pudimos abrir el cajón, usamos el tema claro por defecto.
    return "light";
  }
}

/**
 * applyTheme pinta de verdad la aplicación con el tema elegido y lo guarda para la próxima vez.
 *
 * Recibe: theme ("light" o "dark").
 * Devuelve: nada. Su trabajo es cambiar cosas en la página (efecto secundario).
 */
/** Expone la funcion apply theme para el flujo de shared frontend. */
export function applyTheme(theme: ThemeMode): void {
  // Si estamos en un entorno sin página (por ejemplo, pruebas automáticas sin navegador), no hacemos nada.
  if (typeof document === "undefined") return;
  // Si el tema es oscuro, marcamos la etiqueta <html> con data-theme="dark".
  // Los estilos de index.css buscan ese marcador para cambiar a colores oscuros.
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  // Si es claro, quitamos esa marca para volver a los colores normales.
  else delete document.documentElement.dataset.theme;
  // Buscamos la etiqueta <meta name="theme-color"> (el color de la barra del celular)
  // y le ponemos el color correspondiente. El "?." significa: si no existe, no hagas nada y no des error.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
  // Intentamos guardar la elección en el cajón para recordarla la próxima vez.
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Si el navegador no deja guardar (por ejemplo, modo privado), el cambio sigue activo mientras la página esté abierta.
    // Este "catch" vacío es intencional: no queremos que la app se rompa por eso.
  }
}

/**
 * ThemeToggle es el botón interruptor que se dibuja en pantalla.
 *
 * Cómo se usa: <ThemeToggle />  (no recibe datos)
 *
 * Qué hace:
 * - Al cargar, lee la elección guardada (o usa el claro).
 * - Cada clic cambia de claro a oscuro o de oscuro a claro.
 * - Muestra la luna si estás en claro (para pasar a oscuro) y el sol si estás en oscuro.
 */
/** Expone la funcion theme toggle para el flujo de shared frontend. */
export function ThemeToggle() {
  // "theme" guarda el tema actual. "setTheme" es la función que lo cambia.
  // readInitialTheme (sin paréntesis) le dice a React: "usa esta función SOLO la primera vez, para el valor inicial".
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  // Cada vez que "theme" cambie, aplicamos el nuevo tema a la página.
  // La lista [theme] al final significa: "vuelve a ejecutar esto solo cuando theme cambie".
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Calculamos cuál será el tema al hacer clic: si estamos en claro, el siguiente es oscuro, y viceversa.
  const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
  // El texto que describe qué hará el botón. Sirve para lectores de pantalla y para el "tooltip" (globito al pasar el mouse).
  const label = theme === "light" ? "Activar tema oscuro" : "Activar tema claro";

  return (
    <button
      // Es un botón normal que no envía formularios.
      type="button"
      // Al hacer clic, cambiamos al tema siguiente.
      onClick={() => setTheme(nextTheme)}
      // Texto para personas que usan lector de pantalla.
      aria-label={label}
      // Texto que aparece como globito cuando el mouse se queda quieto encima del botón.
      title={label}
      // Clases de estilo: "jelly" (rebote al tocar), "neo-raised" (relieve), tamaño mínimo de 44 px para que sea fácil de tocar,
      // texto pequeño y en color gris claro, y al pasar el mouse el texto se vuelve azul claro (hover:text-accent-cyan).
      className="jelly neo-raised inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-200 hover:text-accent-cyan"
    >
      {/* Si estamos en claro, dibujamos la luna y el texto "Tema oscuro". Si estamos en oscuro, el sol y "Tema claro". */}
      {theme === "light" ? (
        <>
          {/* Icono de luna morada. "aria-hidden" esconde el dibujo para lectores de pantalla (ya tenemos el aria-label). */}
          <FiMoon aria-hidden="true" className="size-4 text-accent-violet" />
          {/* El texto solo aparece en pantallas medianas o grandes ("hidden sm:inline"): en celulares solo se ve el icono. */}
          <span className="hidden sm:inline">Tema oscuro</span>
        </>
      ) : (
        <>
          {/* Icono de sol amarillento. */}
          <FiSun aria-hidden="true" className="size-4 text-amber-200" />
          {/* Igual que arriba: el texto se muestra solo en pantallas medianas o grandes. */}
          <span className="hidden sm:inline">Tema claro</span>
        </>
      )}
    </button>
  );
}
