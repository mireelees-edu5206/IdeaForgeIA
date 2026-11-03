/**
 * ARCHIVO: Sidebar.tsx
 *
 * ¿Qué es?
 * Es el menú lateral de la izquierda, como el índice de un libro que siempre está a la vista.
 * Solo aparece en computadoras y tablets grandes; en celulares se usa la barra de abajo (Topbar.tsx).
 *
 * ¿Para qué sirve?
 * - Muestra el logo y un botón grande "Nueva idea".
 * - Muestra la lista de secciones (Panel, Proyectos, Configuración y, si eres admin, Administración).
 * - Muestra una pequeña tarjeta que recuerda la idea principal del producto.
 *
 * ¿Quién lo usa?
 * AppShell.tsx lo dibuja a la izquierda de cada pantalla privada.
 */

/* Iconos: "FiPlus" (más) y "FiShield" (escudo, para admin). */
import { FiPlus, FiShield } from "react-icons/fi";
/* "NavLink" es un enlace que sabe si es la página actual. */
import { NavLink } from "react-router";

/* Traemos "useAuth": nos da los datos de la persona con la sesión iniciada. */
import { useAuth } from "../../features/auth/AuthContext";
/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";
/* Enlace con apariencia de botón (para "Nueva idea"). */
import { LinkButton } from "../ui/LinkButton";
/* El logo de IdeaForge. */
import { Logo } from "../ui/Logo";
/* La lista base de opciones del menú. */
import { NAV_ITEMS } from "./navigation";

/**
 * Sidebar dibuja el menú lateral completo.
 *
 * Cómo se usa: <Sidebar /> (no recibe datos).
 *
 * Qué hace:
 * 1. Revisa si la persona es administradora.
 * 2. Arma la lista de opciones (si es admin, agrega "Administración" al final).
 * 3. Dibuja el logo, el botón "Nueva idea", la lista y la tarjeta de ayuda.
 */
/** Expone la funcion sidebar para el flujo de shared frontend. */
export function Sidebar() {
  // Sacamos los datos de la cuenta. "user" puede ser null si nadie ha iniciado sesión.
  const { user } = useAuth();
  // Preparamos la lista de opciones del menú.
  // Si el usuario es admin ("user?.role === 'admin'"), copiamos la lista base y agregamos "Administración" con escudo al final.
  // Si no, usamos la lista base tal cual.
  const navItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { to: "/admin", label: "Administración", icon: FiShield }]
      : NAV_ITEMS;

  return (
    // La caja del menú lateral.
    // - "glass": efecto de cristal.
    // - "sticky top-4": se queda fija al desplazarse.
    // - "hidden ... lg:flex": oculta en celulares y tablets chicas; lo muestra en pantallas grandes en forma de columna.
    // - "h-[calc(100dvh-2rem)]": ocupa casi toda la altura de la pantalla.
    // - "rounded-[1.75rem] p-4": esquinas muy redondeadas y espacio interior.
    <aside className="glass sticky top-4 hidden h-[calc(100dvh-2rem)] flex-col rounded-[1.75rem] p-4 lg:flex">
      {/* Un bloque con el logo. "px-1" es un pequeño espacio a los lados. */}
      <div className="px-1">
        <Logo />
      </div>

      {/* El botón grande para crear una idea nueva. "w-full" ocupa todo el ancho y "justify-center" lo centra. */}
      <LinkButton
        to="/proyectos/nuevo"
        icon={<FiPlus aria-hidden="true" />}
        className="mt-7 w-full justify-center"
      >
        Nueva idea
      </LinkButton>

      {/* El bloque de navegación con el título "Tu espacio". */}
      <div className="mt-8">
        {/* El pequeño título de la sección. */}
        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
          Tu espacio
        </p>
        {/* "nav" es la etiqueta semántica para "esto es un menú de navegación". "aria-label" lo describe para lectores de pantalla. */}
        <nav aria-label="Navegación principal">
          {/* "ul" es una lista sin viñetas; cada opción va dentro de un "li". "gap-1.5" separa cada opción. */}
          <ul className="flex flex-col gap-1.5">
            {/* Recorremos la lista de opciones y dibujamos una por una. */}
            {navItems.map(({ to, label, icon: Icon, end }) => (
              // "key={to}" es el nombre único de cada opción para que React no se confunda.
              <li key={to}>
                <NavLink
                  to={to}
                  // "end" hace que el enlace solo se marque como activo en la dirección exacta (por ejemplo, "/" no se marca en "/proyectos").
                  end={end}
                  // La función recibe "isActive" (si esta es la página actual) y devuelve las clases de estilo.
                  className={({ isActive }) =>
                    cn(
                      // Clases comunes: "group" (para efectos al pasar el mouse), "jelly" (rebote), altura táctil de 44 px, texto mediano y transición suave.
                      "group jelly relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                      // Si es la página actual: relieve, texto azul y un borde azul suave. Si no: texto gris y un fondo gris muy suave al pasar el mouse.
                      isActive
                        ? "neo-raised text-accent-cyan ring-1 ring-accent-cyan/25"
                        : "text-slate-300 hover:bg-slate-400/10 hover:text-slate-100",
                    )
                  }
                >
                  {/* Dentro del enlace, otra función que también recibe "isActive" para decidir qué dibujar. */}
                  {({ isActive }) => (
                    // Los "<>...</>" agrupan varios elementos sin crear uno extra.
                    <>
                      {/* El icono de la opción. Si está activa, se pinta azul; si no, gris. */}
                      <Icon
                        aria-hidden="true"
                        className={cn("size-4 shrink-0", isActive ? "text-accent-cyan" : "text-slate-400")}
                      />
                      {/* El nombre de la opción. */}
                      <span>{label}</span>
                      {/* Si esta opción es la activa, mostramos un puntito de luz azul a la derecha. Si no, no mostramos nada. */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          // "shadow-[0_0_10px...]" le pone un brillo alrededor del punto.
                          className="ml-auto size-1.5 rounded-full bg-accent-cyan shadow-[0_0_10px_var(--color-accent-cyan)]"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

    </aside>
  );
}
