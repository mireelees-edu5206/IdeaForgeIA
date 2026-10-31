/**
 * ARCHIVO: Topbar.tsx
 *
 * ¿Qué es?
 * Es la barra de arriba de la aplicación. Muestra el logo (en celulares), el nombre de la página
 * en la que estás, un botón para crear una idea nueva, el interruptor de tema claro/oscuro y tu cuenta.
 * En celulares también dibuja una barra de botones abajo, como la barra inferior de una app de mensajes.
 *
 * ¿Para qué sirve?
 * Te ayuda a saber dónde estás y a moverte rápido a las secciones principales.
 *
 * ¿Quién lo usa?
 * AppShell.tsx lo dibuja en cada pantalla privada.
 *
 * Datos que usa:
 * - La cuenta del usuario (useAuth): para mostrar la inicial y el nombre, y para mostrar "Admin" solo a administradores.
 * - La dirección actual (useLocation): para escribir el nombre de la página.
 * - La lista de menú (NAV_ITEMS, en navigation.ts).
 */

/* Iconos: "FiPlus" (más), "FiShield" (escudo, para admin), "FiSliders" (perillas, para configuración). */
import { FiPlus, FiShield, FiSliders } from "react-icons/fi";
/* "NavLink" es un enlace que sabe si es la página actual (y se ve distinto). "useLocation" nos da la dirección actual. */
import { NavLink, useLocation } from "react-router";

/* Traemos "useAuth": la función que nos da los datos de la persona que inició sesión. */
import { useAuth } from "../../features/auth/AuthContext";
/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";
/* Enlace con apariencia de botón (lo usamos para "Nueva idea"). */
import { LinkButton } from "../ui/LinkButton";
/* El logo de IdeaForge. */
import { Logo } from "../ui/Logo";
/* El interruptor claro/oscuro. */
import { ThemeToggle } from "../ui/ThemeToggle";
/* La lista de enlaces del menú: Panel, Proyectos y Configuración. */
import { NAV_ITEMS } from "./navigation";

/**
 * pageLabel convierte la dirección actual en un nombre legible para mostrar arriba.
 * Es como un letrero que dice en qué sala estás.
 *
 * Recibe: pathname, la dirección actual (por ejemplo "/proyectos").
 * Devuelve: el texto del letrero (por ejemplo "Proyectos"). Si no reconoce la dirección, devuelve "IdeaForge".
 */
/** Gestiona page label de interfaz compartida. */
function pageLabel(pathname: string): string {
  // Si estamos en la página principal "/", el letrero dice "Panel".
  if (pathname === "/") return "Panel";
  // Si estamos en la lista de proyectos, dice "Proyectos".
  if (pathname === "/proyectos") return "Proyectos";
  // Si estamos creando un proyecto nuevo.
  if (pathname === "/proyectos/nuevo") return "Nuevo proyecto";
  // Si estamos dentro de cualquier proyecto (su dirección empieza con "/proyectos/").
  if (pathname.startsWith("/proyectos/")) return "Área de proyecto";
  // Si estamos en la parte de administración (la dirección empieza con "/admin").
  if (pathname.startsWith("/admin")) return "Administración";
  // Si estamos en configuración.
  if (pathname === "/configuracion") return "Configuración";
  // Si no reconocemos la dirección, mostramos el nombre de la aplicación.
  return "IdeaForge";
}

/**
 * Topbar dibuja la barra superior y, en celulares, la barra inferior.
 *
 * Cómo se usa: <Topbar /> (no recibe datos; toma todo de la cuenta y de la dirección actual).
 *
 * Qué muestra:
 * - Con sesión iniciada: la inicial de tu nombre dentro de un cuadrito y tu primer nombre.
 * - Si eres administrador: un botón extra "Admin" con escudo.
 * - Si no has iniciado sesión, "user" es null y se muestran valores de respaldo ("?" y "Cuenta").
 */
/** Expone la funcion topbar para el flujo de shared frontend. */
export function Topbar() {
  // Sacamos de la sesión los datos del usuario ("user"). Puede ser null si nadie inició sesión.
  const { user } = useAuth();
  // Dirección actual, para el letrero de la página.
  const { pathname } = useLocation();
  // La inicial: quitamos espacios sobrantes con "trim", tomamos el primer carácter con "charAt(0)" y lo ponemos en mayúscula.
  // Si no hay usuario, "?" es el valor de respaldo (el operador "??" significa "si no hay nada, usa esto").
  const initial = user?.full_name.trim().charAt(0).toUpperCase() ?? "?";
  // El primer nombre: separamos el nombre completo por espacios y tomamos el primer trozo. Si no hay nombre, usamos "Cuenta".
  const firstName = user?.full_name.trim().split(" ")[0] ?? "Cuenta";
  // Preparamos la lista de botones del menú móvil.
  // Si el usuario es administrador, agregamos al final un botón "Admin" con su icono de escudo.
  // Si no lo es, usamos la lista normal. "[...NAV_ITEMS, ...]" significa "copia todo y agrega uno más al final".
  const navItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: FiShield }]
      : NAV_ITEMS;

  return (
    // Usamos "<>...</>" para agrupar dos bloques sin crear un elemento extra: la barra superior y la barra inferior.
    <>
      {/* La barra superior. "glass" le da efecto de cristal; "sticky top-3" hace que se quede pegada arriba al desplazarse. */}
      <header className="glass sticky top-3 z-30 flex min-h-[4.25rem] items-center justify-between gap-2 rounded-2xl px-3 py-2.5 sm:gap-3 sm:px-4">
        {/* Lado izquierdo: logo (solo celular), una línea separadora (solo computadora) y el letrero. */}
        <div className="flex min-w-0 items-center gap-3">
          {/* El logo se ve solo en pantallas pequeñas ("lg:hidden" lo oculta en computadoras). "compact" pide la versión chica. */}
          <span className="lg:hidden">
            <Logo compact />
          </span>
          {/* Una línea vertical fina que separa el logo del texto. Solo se ve en computadoras (lg:block). */}
          {/* "bg-border" es su color. "aria-hidden" la esconde de los lectores de pantalla porque no aporta texto. */}
          <span className="hidden h-8 w-px bg-border lg:block" aria-hidden="true" />
          <div className="min-w-0">
            {/* Una frase pequeña arriba del título. Solo aparece en pantallas medianas o grandes ("hidden sm:block"). */}
            <p className="hidden text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:block">
              IdeaForge <span className="px-1 text-accent">/</span> Investigación de negocio
            </p>
            {/* El nombre de la página actual. "truncate" corta el texto con "..." si es muy largo. */}
            <p className="truncate text-sm font-semibold text-slate-100 sm:text-base">{pageLabel(pathname)}</p>
          </div>
        </div>

        {/* Lado derecho: botón "Nueva idea", interruptor de tema y la tarjeta de tu cuenta. */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Botón para crear una idea nueva. Solo se ve en pantallas medianas o grandes ("hidden md:inline-flex"). */}
          <LinkButton
            to="/proyectos/nuevo"
            size="sm"
            icon={<FiPlus aria-hidden="true" />}
            className="hidden md:inline-flex"
          >
            Nueva idea
          </LinkButton>
          {/* El interruptor de claro/oscuro. */}
          <ThemeToggle />
          {/* La tarjeta de la cuenta. Es un enlace a /configuracion. */}
          <NavLink
            to="/configuracion"
            // Texto para lectores de pantalla: dice de quién es la cuenta y a dónde lleva.
            aria-label={`Cuenta de ${firstName}; abrir configuración`}
            // "className" puede ser una función: recibe "isActive" (si estamos en esa página) y devuelve las clases.
            className={({ isActive }) =>
              cn(
                // Clases base: "jelly" (rebote), "neo-raised" (relieve), tamaño táctil de 44 px, texto pequeño y en negrita.
                "jelly neo-raised inline-flex min-h-11 min-w-11 items-center gap-2 rounded-xl px-1.5 py-1.5 text-xs font-semibold transition sm:pr-3",
                // Si estamos en configuración, se ve con un anillo azul; si no, el texto es gris claro y se vuelve azul al pasar el mouse.
                isActive ? "ring-2 ring-accent-cyan text-accent-cyan" : "text-slate-200 hover:text-accent-cyan",
              )
            }
          >
            {/* El cuadrito con la inicial. "bg-primary/10" es un fondo azul muy suave, "text-primary" el color del texto. */}
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary"
            >
              {initial}
            </span>
            {/* El primer nombre. Solo se ve en pantallas medianas o grandes ("hidden sm:inline"). */}
            <span className="hidden sm:inline">{firstName}</span>
            {/* Un icono de perillas (ajustes). Solo se ve en pantallas medianas o grandes. */}
            <FiSliders aria-hidden="true" className="hidden size-3.5 text-slate-400 sm:block" />
          </NavLink>
        </div>
      </header>

      {/* La barra inferior de botones, para celulares. "fixed ... bottom-2" la pega abajo. "md:hidden" la oculta en pantallas medianas o grandes. */}
      <nav
        aria-label="Acceso rápido móvil"
        className="glass fixed inset-x-2 bottom-2 z-30 flex items-center justify-around gap-1 rounded-2xl p-1.5 md:hidden"
      >
        {/* Recorremos la lista de opciones y dibujamos un botón por cada una. "map" significa "para cada elemento, haz esto". */}
        {navItems.map(({ to, label, icon: Icon, end }) => (
          // "key={to}" le da a cada botón un nombre único para que React no se confunda al redibujar.
          <NavLink
            key={to}
            to={to}
            end={end}
            // Si la página es la actual, el botón se ve "levantado" y azul. Si no, texto gris claro.
            className={({ isActive }) =>
              cn(
                "jelly flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-medium",
                isActive ? "neo-raised text-primary" : "text-slate-300",
              )
            }
          >
            {/* El icono de la opción. "Icon" es el nombre que le dimos al icono al desarmar la lista. */}
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            {/* El nombre de la opción, cortado con "..." si no cabe. */}
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        {/* El botón final de la barra móvil: "Nueva" para crear una idea, con fondo principal ámbar/azul. */}
        <NavLink
          to="/proyectos/nuevo"
          className="jelly liquid-btn-primary flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-semibold text-white"
        >
          <FiPlus aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Nueva</span>
        </NavLink>
      </nav>
    </>
  );
}
